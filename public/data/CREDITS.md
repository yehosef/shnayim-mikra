# Text credits

All texts are served from static JSON files fetched from [Sefaria](https://www.sefaria.org).

| Layer | Version | Licence | Source |
|---|---|---|---|
| Torah (Hebrew, with trop) | Tanach with Ta'amei Hamikra (Sefaria) | Public Domain | https://www.sefaria.org |
| Targum Onkelos | Sifsei Chachomim Chumash, Metsudah Publications, 2009 (via Sefaria) | CC-BY-NC | https://www.sefaria.org/Onkelos_Genesis |
| Rashi | Rashi Chumash, Metsudah Publications, 2009 (via Sefaria) | CC-BY | https://www.nli.org.il/he/books/NNL_ALEPH002691623 |
| English | The Contemporary Torah, Jewish Publication Society, 2006 (via Sefaria) | CC-BY-NC | https://www.nli.org.il/he/books/NNL_ALEPH002529489/NLI |

Aliyah boundaries are generated from [@hebcal/leyning](https://github.com/hebcal/hebcal-leyning)
(BSD-2-Clause). Calendar computations use [@hebcal/core](https://github.com/hebcal/hebcal-es6)
(GPL-2.0).

Each data file carries `versionTitle`, `versionSource`, and `license` (english/rashi also `fetchedAt`,
last refetched 2026-09-06). Run `node scripts/report-versions.mjs` to list current Sefaria
versions and licences before refetching.
