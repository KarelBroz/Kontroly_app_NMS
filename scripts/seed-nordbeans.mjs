// Založí v projektu MS Nordbeans (CZ26529) šablonu "Nordbeans kavárna",
// scénář ve vlně a pravidla ze scripts/nordbeans-rules.mjs.
//
//   node scripts/seed-nordbeans.mjs <název vlny>          — jen vypíše, co by udělal
//   node scripts/seed-nordbeans.mjs <název vlny> --apply  — zapíše do databáze
//
// Vlnu i šablonu založí, když chybí. Pravidla typu CONDITION scénáře nahradí
// aktuální verzí ze souboru (i s jejich nálezy); jiná pravidla nechá být.
// DATABASE_URL se bere z .env.local.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { RULES } from "./nordbeans-rules.mjs";

const PROJECT_CODE = "CZ26529";
const TEMPLATE_NAME = "Nordbeans kavárna";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL="?([^"\r\n]*)"?/m)?.[1];

const [waveName, flag] = process.argv.slice(2);
const apply = flag === "--apply";
if (!waveName) {
  console.error("Použití: node scripts/seed-nordbeans.mjs <název vlny> [--apply]");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const project = await prisma.project.findUnique({ where: { code: PROJECT_CODE } });
  if (!project) throw new Error(`Projekt ${PROJECT_CODE} neexistuje.`);
  const wave = await prisma.wave.findFirst({ where: { projectId: project.id, name: waveName } });
  const template = await prisma.scenarioTemplate.findUnique({
    where: { projectId_name: { projectId: project.id, name: TEMPLATE_NAME } },
  });
  const scenario =
    wave && template
      ? await prisma.scenario.findUnique({
          where: { waveId_scenarioTemplateId: { waveId: wave.id, scenarioTemplateId: template.id } },
          include: { rules: { select: { type: true } } },
        })
      : null;
  const conditionCount = scenario?.rules.filter((r) => r.type === "CONDITION").length ?? 0;

  console.log(`Projekt: ${project.name}`);
  console.log(`Vlna "${waveName}": ${wave ? "existuje" : "založí se"}`);
  console.log(`Šablona "${TEMPLATE_NAME}": ${template ? "existuje" : "založí se"} · scénář: ${scenario ? "existuje" : "založí se"}`);
  console.log(`CONDITION pravidel: smaže se ${conditionCount}, založí ${RULES.length}`);

  if (!apply) {
    console.log("\nNanečisto. Pro zápis spusť znovu s --apply.");
  } else {
    const w = wave ?? (await prisma.wave.create({ data: { projectId: project.id, name: waveName } }));
    const tpl = template ?? (await prisma.scenarioTemplate.create({ data: { projectId: project.id, name: TEMPLATE_NAME } }));
    const sc = scenario ?? (await prisma.scenario.create({ data: { waveId: w.id, scenarioTemplateId: tpl.id } }));
    await prisma.$transaction([
      prisma.rule.deleteMany({ where: { scenarioId: sc.id, type: "CONDITION" } }),
      prisma.rule.createMany({
        data: RULES.map((r) => ({
          scenarioId: sc.id,
          type: "CONDITION",
          name: `${r.code} — ${r.description}`,
          config: JSON.parse(JSON.stringify(r)),
        })),
      }),
    ]);
    console.log(`\nHotovo: vlna ${w.id}, šablona ${tpl.id}, scénář ${sc.id}, ${RULES.length} pravidel.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
