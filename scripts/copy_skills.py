import os, glob, json

src = r'D:\1-yinyong\ai编程\AI项目\AI自动化渗透测试\hack-skills-main\hack-skills-main\skills'
dst = r'D:\1-yinyong\ai编程\AI项目\渗透测试智能体平台\vulnflow-project\frontend\public\skills'

# 清空旧文件
for f in glob.glob(os.path.join(dst, '*.md')):
    os.remove(f)
idx_path = os.path.join(dst, 'index.json')
if os.path.exists(idx_path):
    os.remove(idx_path)

index = []
count = 0

for dirpath in sorted(glob.glob(os.path.join(src, '*', ''))):
    name = os.path.basename(os.path.normpath(dirpath))
    # 找 SKILL.md
    md = None
    for fn in ('SKILL.md', 'skill.md', 'README.md'):
        fp = os.path.join(dirpath, fn)
        if os.path.isfile(fp):
            md = fp
            break
    if not md:
        mds = sorted(glob.glob(os.path.join(dirpath, '*.md')))
        if mds:
            md = mds[0]
    if not md:
        continue

    with open(md, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    out_name = name + '.md'
    out_path = os.path.join(dst, out_name)

    # 检查是否有 frontmatter
    if not content.startswith('---'):
        first_line = content.strip().split('\n')[0].lstrip('# ').strip()
        display = ' '.join(w.capitalize() for w in name.replace('-', ' ').split())
        fm = f'''---
name: {name}
display_name: {display}
description: {first_line[:150]}
category: exploitation
severity: medium
author: hack-skills
version: 1.0.0
tags: [{', '.join(name.split('-')[:4])}]
---
'''
        content = fm + content

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)

    index.append(out_name)
    count += 1

with open(idx_path, 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

print(f'完成！共导入 {count} 个技能文件')
