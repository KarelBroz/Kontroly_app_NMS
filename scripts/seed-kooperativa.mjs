// Založí / aktualizuje v projektu MS Kooperativa (CZ26222) čtyři scénáře
// a jejich pravidla ze scripts/kooperativa-rules.mjs.
//
//   node scripts/seed-kooperativa.mjs <název vlny>          — jen vypíše, co by udělal
//   node scripts/seed-kooperativa.mjs <název vlny> --apply  — zapíše do databáze
//
// Pro každý scénář: chybějící šablonu a scénář ve vlně založí, doplní
// klasická pravidla (X20, F10, D10t), pokud scénáři chybí, a všechna jeho
// pravidla typu CONDITION nahradí aktuální verzí ze souboru (i s nálezy).
// Klasická pravidla, která už existují, nechá být (i když je někdo upravil).
// Po --apply v appce na stránce vlny klikni na „Zkontrolovat znovu“.
//
// DATABASE_URL se bere z .env.local.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { SCENARIOS, CLASSIC_RULES } from "./kooperativa-rules.mjs";

const PROJECT_CODE = "CZ26222";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL="?([^"\r\n]*)"?/m)?.[1];

const [waveName, flag] = process.argv.slice(2);
const apply = flag === "--apply";
if (!waveName) {
  console.error("Použití: node scripts/seed-kooperativa.mjs <název vlny> [--apply]");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const project = await prisma.project.findUnique({ where: { code: PROJECT_CODE } });
  if (!project) throw new Error(`Projekt ${PROJECT_CODE} neexistuje.`);
  const wave = await prisma.wave.findFirst({ where: { projectId: project.id, name: waveName } });
  if (!wave) throw new Error(`Vlna "${waveName}" v projektu ${project.name} neexistuje.`);
  console.log(`Projekt: ${project.name} · vlna: ${wave.name}${apply ? "" : " · NANEČISTO"}\n`);

  for (const sc of SCENARIOS) {
    const template = await prisma.scenarioTemplate.findUnique({
      where: { projectId_name: { projectId: project.id, name: sc.template } },
    });
    const scenario = template
      ? await prisma.scenario.findUnique({
          where: { waveId_scenarioTemplateId: { waveId: wave.id, scenarioTemplateId: template.id } },
          include: { rules: true },
        })
      : null;
    const existingRules = scenario?.rules ?? [];
    const conditionRules = existingRules.filter((r) => r.type === "CONDITION");
    const missingClassic = CLASSIC_RULES.filter(
      (c) => !existingRules.some((r) => r.type === c.type && r.config?.questionCode === c.config.questionCode)
    );

    console.log(`■ ${sc.template}: šablona ${template ? "existuje" : "založí se"}, scénář ${scenario ? "existuje" : "založí se"}`);
    console.log(`  klasická pravidla k doplnění: ${missingClassic.map((c) => c.name).join(", ") || "–"}`);
    console.log(`  CONDITION pravidel: smaže se ${conditionRules.length}, založí ${sc.rules.length} (${sc.rules.map((r) => r.code).join(", ")})`);

    if (!apply) continue;
    const tpl = template ?? (await prisma.scenarioTemplate.create({ data: { projectId: project.id, name: sc.template } }));
    const scn = scenario ?? (await prisma.scenario.create({ data: { waveId: wave.id, scenarioTemplateId: tpl.id } }));
    await prisma.$transaction([
      prisma.rule.deleteMany({ where: { scenarioId: scn.id, type: "CONDITION" } }),
      prisma.rule.createMany({
        data: [
          ...missingClassic.map((c) => ({ scenarioId: scn.id, type: c.type, name: c.name, config: c.config })),
          ...sc.rules.map((r) => ({
            scenarioId: scn.id,
            type: "CONDITION",
            name: `${r.code} — ${r.description}`,
            // JSON round-trip zahodí nevyplněné `when`
            config: JSON.parse(JSON.stringify(r)),
          })),
        ],
      }),
    ]);
    console.log("  ✓ zapsáno");
  }
  if (!apply) console.log("\nPro zápis spusť znovu s --apply.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
