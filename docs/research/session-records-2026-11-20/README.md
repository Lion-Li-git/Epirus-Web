# dsh 会话训练记录（2026-11-20 抽取）

本目录是从 17 个 dsh 会话（session.v4/v3.jsonl.zstd）抽取的训练配方原件，配套文档见 ../TRAINING-RECORDS-2026-11-20.md。

## 文件

- training-recipes-consolidated.tsv：去重后的训练记录（127 条 server /train URL + 97 条 train-3p），列：type、session、root、gens、n、games、pop、seed、opps、mode、fresh、command。其中 games 列对应 URL 的 gpo 参数。
- server-urls-all.tsv：原始命中的全部 /train? URL（210 条，含占位符与重复）。
- train3p-all.tsv：原始命中的 train-3p 命令片段（778 条，含代码/文档中的示例）。
- roots-all.tsv：命令里 cp 到 js/bundled-champion-3p.js 的根包记录（13 条）。

## 来源会话

227e2bc8-49f3-4852-9923-92f8333e03d5、0add3d39-7534-4b8a-b64b-8afdeaf07d2b、4d4a95f4-4ee6-4231-9cc0-7e55372b98b6、0eabf427-33d3-4475-b859-9dda1201ae22、e68ffc09-9558-47a7-aa89-a59e3b0c7fab、7134b299-8442-430e-b03c-bd4f9332bd76、d32b00d3-7e30-4bf7-96ad-efaa77ad47ff、ced71ba1-791e-4657-86f3-91cbe9eb186c、0f082cf0-1ded-445e-8bf1-86fb6c87de76、47b47327-0aa8-4958-8acc-e505b84fb79b、b3a09167-612e-4cfe-8bc5-99db4f6f64af、02aa89f9-ca7a-4143-8304-5c3320544b47、f2f41eee-f2b7-4d9d-a848-40ce00ce597b、2b7cc70b-c5f4-44eb-a3e5-d883d2b319b2、04e0a3ef-782a-40e0-a1eb-fc943e064895、af4c3351-80bc-48cd-91ee-bc744ef18bb6、7715716a-c7fb-47ca-9399-ed91c76ffe4a。

## 注意

- 含 shell 变量（$S/$B/$POOL）或 ${...} 的 URL 已从 consolidated 剔除，原件保留在 server-urls-all.tsv。
- 没有逐条 URL 的时间戳；会话日期范围见主文档。
- 用法与复刻步骤以主文档第六节为准。
