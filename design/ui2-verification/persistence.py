import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('design/ui2-verification');errors=[]
with sync_playwright() as p:
 b=p.chromium.launch();c=b.new_context(viewport={'width':844,'height':390},has_touch=True,is_mobile=True,locale='ja-JP');page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto('http://127.0.0.1:8981/viewer.html?sample=feature-test');page.wait_for_selector('#phone-next:not([disabled])')
 page.locator('#phone-memo').click();page.locator('#study-note').fill('既存付箋の保持検証');page.wait_for_timeout(500)
 seed=page.evaluate("""() => {const key=Object.keys(localStorage).find(k=>k.startsWith('stage-study-notebook-v1:')),doc=JSON.parse(localStorage.getItem(key)),entry=Object.values(doc.entries)[0];entry.stickies=[{id:'ui2-preserved',view:'front',x:.5,y:.5,text:'保存済み付箋',shape:'rect',color:'paper'}];localStorage.setItem(key,JSON.stringify(doc));localStorage.setItem('stage-study-ui2-preserve','untouched');return {key,stickies:entry.stickies};}""")
 page.reload();page.wait_for_selector('#phone-next:not([disabled])');page.wait_for_timeout(200);f=page.frames[1]
 sticky=f.locator('.study-sticky-note').first
 assert sticky.count()==1 and sticky.get_attribute('tabindex')=='-1'
 assert sticky.evaluate('(e)=>getComputedStyle(e).pointerEvents')=='none'
 before=page.evaluate('(key)=>localStorage.getItem(key)',seed['key'])
 page.evaluate("""() => {const f=document.querySelector('iframe'); for(const action of ['sticky-add','sticky-mode','sticky-focus']) f.contentWindow.postMessage({channel:'stage-study',action,view:'front',enabled:true,id:'ui2-preserved'},'*');}""")
 page.wait_for_timeout(100);assert page.evaluate('(key)=>localStorage.getItem(key)',seed['key'])==before
 # Drawing and undo remain functional.
 page.locator('#phone-tools').click();page.locator('#study-pen').click()
 f.wait_for_function("document.querySelector('.study-front .study-pen-layer').style.pointerEvents === 'auto'")
 rect=f.locator('.study-front .viewer-viewport').bounding_box();x=rect['x']+rect['width']*.45;y=rect['y']+rect['height']*.55
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+40,y+20,steps=5);page.mouse.up();page.wait_for_timeout(400)
 page.locator('#phone-tools').click();assert page.locator('#study-pen-undo').is_enabled();page.locator('#study-pen-undo').click();page.wait_for_timeout(200);assert page.locator('#study-pen-undo').is_disabled()
 page.locator('#phone-close').click();page.locator('#phone-memo').click();page.locator('#study-note').fill('テキストだけ更新');page.wait_for_timeout(500)
 doc=json.loads(page.evaluate('(key)=>localStorage.getItem(key)',seed['key']));assert next(iter(doc['entries'].values()))['stickies']==seed['stickies']
 assert page.evaluate("localStorage.getItem('stage-study-ui2-preserve')")=='untouched'
 page.locator('#phone-close').click();page.locator('#phone-menu').click();page.locator('#phone-light').click();assert page.locator('#phone-light').get_attribute('aria-pressed')=='true';page.locator('#phone-close').click()
 page.locator('#phone-next').click();page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200);assert page.locator('#phone-light').get_attribute('aria-pressed')=='true'
 page.reload();page.wait_for_selector('#phone-next:not([disabled])');assert page.locator('#phone-light').get_attribute('aria-pressed')=='true'
 page.locator('#phone-light').click();assert page.locator('#phone-light').get_attribute('aria-pressed')=='false'
 assert not errors,errors
 b.close()
(OUT/'persistence.json').write_text(json.dumps({'existingStickies':'unchanged after text and pen edits','retiredStickyMessages':'ignored','penAndUndo':'passed','lightSceneRotateReload':'passed','consoleErrors':errors},ensure_ascii=False,indent=2));print('persistence passed')
