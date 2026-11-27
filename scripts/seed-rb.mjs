// Založí v projektu MS Raiffeisenbank (CZ26011) šablony RB Servis,
// RB Akvizice a RB Pokladny, jejich scénáře ve vlně a pravidla ze
// scripts/rb-rules.mjs.
//
//   node scripts/seed-rb.mjs <název vlny>          — jen vypíše, co by udělal
//   node scripts/seed-rb.mjs <název vlny> --apply  — zapíše do databáze
//
// Vlnu, šablony i scénáře založí, když chybí. Pravidla typu CONDITION
// scénářů nahradí aktuální verzí ze souboru (i s jejich nálezy); jiná
// pravidla nechá být. DATABASE_URL se bere z .env.local.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { SCENARIOS } from "./rb-rules.mjs";

const PROJECT_CODE = "CZ26011";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL="?([^"\r\n]*)"?/m)?.[1];

const [waveName, flag] = process.argv.slice(2);
const apply = flag === "--apply";
if (!waveName) {
  console.error("Použití: node scripts/seed-rb.mjs <název vlny> [--apply]");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const project = await prisma.project.findUnique({ where: { code: PROJECT_CODE } });
  if (!project) throw new Error(`Projekt ${PROJECT_CODE} neexistuje.`);
  let wave = await prisma.wave.findFirst({ where: { projectId: project.id, name: waveName } });
  console.log(`Projekt: ${project.name} · vlna "${waveName}": ${wave ? "existuje" : "založí se"}${apply ? "" : " · NANEČISTO"}`);
  if (apply && !wave) wave = await prisma.wave.create({ data: { projectId: project.id, name: waveName } });

  for (const sc of SCENARIOS) {
    const template = await prisma.scenarioTemplate.findUnique({
      where: { projectId_name: { projectId: project.id, name: sc.template } },
    });
    const scenario =
      wave && template
        ? await prisma.scenario.findUnique({
            where: { waveId_scenarioTemplateId: { waveId: wave.id, scenarioTemplateId: template.id } },
            include: { rules: { select: { type: true } } },
          })
        : null;
    const conditionCount = scenario?.rules.filter((r) => r.type === "CONDITION").length ?? 0;
    console.log(`■ ${sc.template}: šablona ${template ? "existuje" : "založí se"}, scénář ${scenario ? "existuje" : "založí se"}, pravidel: smaže se ${conditionCount}, založí ${sc.rules.length}`);
    if (!apply) continue;

    const tpl = template ?? (await prisma.scenarioTemplate.create({ data: { projectId: project.id, name: sc.template } }));
    const scn = scenario ?? (await prisma.scenario.create({ data: { waveId: wave.id, scenarioTemplateId: tpl.id } }));
    await prisma.$transaction([
      prisma.rule.deleteMany({ where: { scenarioId: scn.id, type: "CONDITION" } }),
      prisma.rule.createMany({
        data: sc.rules.map((r) => ({
          scenarioId: scn.id,
          type: "CONDITION",
          name: `${r.code} — ${r.description}`,
          config: JSON.parse(JSON.stringify(r)),
        })),
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
