#!/usr/bin/env python3
"""Install audit pagination/search source code. Run from repository root."""
from pathlib import Path
import shutil

source = Path(__file__).resolve().parent
root = Path.cwd()
controller = root / 'apps/api/src/coffee.controller.ts'
module = root / 'apps/api/src/app.module.ts'
page = root / 'apps/web/src/pages/AuditPage.tsx'
if not all(p.exists() for p in (controller, module, page)):
    raise SystemExit('Run from EstyloCoffee root (apps/api and apps/web required).')
ctrl = controller.read_text(encoding='utf-8')
start = ctrl.find('  @Get("audit")')
end = ctrl.find('  @Get("reports")', start)
if start >= 0 and end >= 0:
    new_ctrl = ctrl[:start] + ctrl[end:]
elif '  @Get("audit")' not in ctrl:
    new_ctrl = ctrl
else:
    raise SystemExit('Unexpected audit handler; no changes applied.')
mod = module.read_text(encoding='utf-8')
if 'AuditController' not in mod:
    needle = 'import { CoffeeController } from "./coffee.controller";'
    if needle not in mod or '    CoffeeController,' not in mod:
        raise SystemExit('Unexpected AppModule; no changes applied.')
    mod = mod.replace(needle, needle + '\nimport { AuditController } from "./audit.controller";')
    mod = mod.replace('    CoffeeController,', '    CoffeeController,\n    AuditController,')
for rel in ['apps/api/src/audit.controller.ts', 'apps/web/src/pages/AuditPage.tsx']:
    target = root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        shutil.copy2(target, target.with_suffix(target.suffix + '.before-audit-update'))
    shutil.copy2(source / rel, target)
for target, content in [(controller, new_ctrl), (module, mod)]:
    if target.read_text(encoding='utf-8') != content:
        shutil.copy2(target, target.with_suffix(target.suffix + '.before-audit-update'))
        target.write_text(content, encoding='utf-8')
print('Audit page and API updated. No scheduling files installed.')
print('Review: git diff')
print('Validate: npm run lint')
