// Названия тем для кабинета ученика: /labs/<опыт>/ → «Предмет · Тема».
// Берёт программы из physics/index.html (физика) и physics/subjects-data.js (остальные предметы).
//   node scripts/topic-names.js  → luch/topic-names.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const SUBJ = { phys: "Физика", math: "Математика", chem: "Химия", bio: "Биология", cs: "Информатика" };
const out = {};
for (const f of ["physics/index.html", "physics/subjects-data.js"]) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  const re = /\{\s*id:\s*'[a-z0-9]+',[^{}]*?\bt:\s*'([^']+)'[^{}]*?href:\s*'(\/labs\/([a-z]+)-[a-z0-9-]+\/)'/g;
  let m; while ((m = re.exec(src))) out[m[2]] = (SUBJ[m[3]] || "") + " · " + m[1];
}
fs.writeFileSync(path.join(ROOT, "luch/topic-names.js"), "// создан scripts/topic-names.js — не править руками\nwindow.LUCH_TOPIC_NAMES = " + JSON.stringify(out, null, 0) + ";\n");
console.log(Object.keys(out).length + " тем");
