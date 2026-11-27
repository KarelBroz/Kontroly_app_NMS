// Založí v projektu Tesco Mobile šablonu scénáře, scénář ve vlně a pravidla
// ze scripts/tesco-mobile-rules.mjs.
//
//   node scripts/seed-tesco-mobile.mjs <název vlny>          — jen vypíše, co by udělal
//   node scripts/seed-tesco-mobile.mjs <název vlny> --apply  — zapíše do databáze
//   node scripts/seed-tesco-mobile.mjs <název vlny> --replace — smaže VŠECHNA
//        pravidla scénáře (i s jejich nálezy) a založí je znovu podle souboru
//
// DATABASE_URL se bere z .env.local. Pokud scénář ve vlně už nějaká pravidla
// má, --apply nic nezmění (aby nevznikly duplicity) — použij --replace.
// Po --replace v appce na stránce vlny klikni na "Zkontrolovat znovu", ať se
// nálezy podle nových pravidel spočítají.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { RULES } from "./tesco-mobile-rules.mjs";

const PROJECT_CODE = "CZ26193";
const TEMPLATE_NAME = "Tesco Mobile MS";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL="?([^"\r\n]*)"?/m)?.[1];

const [waveName, flag] = process.argv.slice(2);
const replace = flag === "--replace";
const apply = flag === "--apply" || replace;
if (!waveName) {
  console.error("Použití: node scripts/seed-tesco-mobile.mjs <název vlny> [--apply]");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const project = await prisma.project.findUnique({ where: { code: PROJECT_CODE } });
  if (!project) throw new Error(`Projekt ${PROJECT_CODE} neexistuje.`);
  const wave = await prisma.wave.findFirst({ where: { projectId: project.id, name: waveName } });
  if (!wave) throw new Error(`Vlna "${waveName}" v projektu ${project.name} neexistuje.`);

  const template = await prisma.scenarioTemplate.findUnique({
    where: { projectId_name: { projectId: project.id, name: TEMPLATE_NAME } },
  });
  const scenario = template
    ? await prisma.scenario.findUnique({
        where: { waveId_scenarioTemplateId: { waveId: wave.id, scenarioTemplateId: template.id } },
        include: { _count: { select: { rules: true } } },
      })
    : null;

  console.log(`Projekt: ${project.name} · vlna: ${wave.name}`);
  console.log(`Šablona "${TEMPLATE_NAME}": ${template ? "existuje" : "založí se"}`);
  console.log(`Scénář ve vlně: ${scenario ? `existuje (${scenario._count.rules} pravidel)` : "založí se"}`);
  console.log(`Pravidel k založení: ${RULES.length}`);

  if (scenario && scenario._count.rules > 0 && !replace) {
    throw new Error("Scénář už pravidla má — nic neměním.");
  }
  if (!apply) {
    console.log("\nNanečisto. Pro zápis spusť znovu s --apply.");
  } else {
    const tpl = template ?? (await prisma.scenarioTemplate.create({ data: { projectId: project.id, name: TEMPLATE_NAME } }));
    const sc = scenario ?? (await prisma.scenario.create({ data: { waveId: wave.id, scenarioTemplateId: tpl.id } }));
    if (replace) {
      const deleted = await prisma.rule.deleteMany({ where: { scenarioId: sc.id } });
      console.log(`Smazáno ${deleted.count} původních pravidel (i s jejich nálezy).`);
    }
    const created = await prisma.rule.createMany({
      data: RULES.map((r) => ({
        scenarioId: sc.id,
        type: "CONDITION",
        name: `${r.code} — ${r.description}`,
        // JSON round-trip zahodí nevyplněné `when` / `questionCode`
        config: JSON.parse(JSON.stringify(r)),
      })),
    });
    console.log(`\nHotovo: šablona ${tpl.id}, scénář ${sc.id}, založeno ${created.count} pravidel.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
