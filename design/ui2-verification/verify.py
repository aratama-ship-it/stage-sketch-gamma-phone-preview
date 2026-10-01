"""Run from preview root with port 8981 serving it; requires Python playwright."""
import json, math
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('design/ui2-verification')
MEASURE="""() => ['front','plan'].map(view => {
 const root=document.querySelector('.study-'+view), vp=root.querySelector('.viewer-viewport'), surface=root.querySelector('.viewer-surface'), canvas=root.querySelector('canvas');
 const r=vp.getBoundingClientRect(), c=canvas.getBoundingClientRect(), b=window.SHOSAI_STAGE_STUDY_RENDERER.stageBounds(view);
 return {view, viewport:{width:r.width,height:r.height}, canvas:{width:c.width,height:c.height}, bounds:b, zoom:Number(surface.dataset.zoom), fit:surface.dataset.fit,
 stage:b?{x:c.x+b.x*c.width,y:c.y+b.y*c.height,width:b.width*c.width,height:b.height*c.height}:null,
 ratio:b?Math.max(b.width*c.width/r.width,b.height*c.height/r.height):null}; })"""
def ready(page):
 page.wait_for_selector('#phone-next:not([disabled])'); page.wait_for_timeout(500)
def frame(page): return next(f for f in page.frames if 'study-frame.html' in f.url)
def menu(page):
 if page.locator('#phone-menu').is_visible() and not page.locator('#phone-view-front').is_visible(): page.locator('#phone-menu').click()
def view(page,v):
 menu(page); page.locator('#phone-view-'+v).click()
 if page.locator('#phone-panel').is_visible(): page.locator('#phone-close').click()
 page.wait_for_timeout(200)
def measure(page): return frame(page).evaluate(MEASURE)
def screenshot(page,name): page.screenshot(path=str(OUT/(name+'.png')))
results=[]; errors=[]; requests=[]
with sync_playwright() as p:
 b=p.chromium.launch()
 for sample in ['romeo-juliet','feature-test','four-outlines']:
  for portrait in [False,True]:
   orientation='portrait' if portrait else 'landscape'
   ctx=b.new_context(viewport={'width':390 if portrait else 844,'height':844 if portrait else 390},has_touch=True,is_mobile=True,locale='ja-JP')
   page=ctx.new_page()
   page.on('pageerror',lambda e: errors.append(str(e)))
   page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
   page.on('request',lambda r: requests.append({'url':r.url,'method':r.method}))
   page.goto('http://127.0.0.1:8981/viewer.html?sample='+sample); ready(page)
   f=frame(page)
   assert page.locator('iframe').first.get_attribute('sandbox')=='allow-scripts'
   assert f.evaluate("() => {try{localStorage.getItem('stage-study-probe');return false}catch{return true}}")
   initial=measure(page); screenshot(page,sample+'-'+orientation+'-default')
   row={'sample':sample,'orientation':orientation,'scene':1,'initial':initial,'views':[]}
   for v in ['front','plan']:
    view(page,v)
    assert page.locator('.phone-detail').is_visible()==(portrait and bool(page.locator('#study-scene-note').inner_text().strip()))
    m=next(x for x in measure(page) if x['view']==v)
    assert m['zoom']==(1.2 if v=='plan' else 1),m
    assert abs(m['ratio']-(.96 if v=='plan' else .8))<.005,m
    # Reach exactly 100% through the real pinch event handler, not a test API.
    if v=='plan':
     rect=f.locator('.study-plan .viewer-viewport').bounding_box(); x=rect['x']+rect['width']/2; y=rect['y']+rect['height']/2
     cdp=ctx.new_cdp_session(page)
     cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x-60,'y':y,'id':71},{'x':x+60,'y':y,'id':72}]})
     cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-49,'y':y,'id':71},{'x':x+49,'y':y,'id':72}]})
     cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); cdp.detach()
     page.wait_for_timeout(100); m=next(x for x in measure(page) if x['view']==v)
    assert abs(m['ratio']-.8)<.005,m
    assert abs(m['zoom']-1)<.005,m
    row['views'].append(m)
    screenshot(page,sample+'-'+orientation+'-'+v+'-100')
    # Controls remain usable, reset has the requested default.
    if not portrait: f.locator('[data-viewer-controls='+v+']').click()
    f.locator('[data-viewer-reset='+v+']').click(); page.wait_for_timeout(80)
    assert next(x for x in measure(page) if x['view']==v)['zoom']==(1.2 if v=='plan' else 1)
    if not portrait: f.locator('[data-viewer-controls='+v+']').click()
   view(page,'both'); assert not page.locator('.phone-detail').is_visible()
   # Scene advance resets both zooms, retains light.
   menu(page)
   light=page.locator('#phone-light')
   assert light.is_visible()==(sample!='four-outlines')
   if light.is_visible():
    before=f.locator('#stage-canvas').evaluate('(c)=>c.toDataURL()'); light.click(); page.wait_for_timeout(150)
    after=f.locator('#stage-canvas').evaluate('(c)=>c.toDataURL()'); assert before!=after
    light.click(); page.wait_for_timeout(150)
    assert before==f.locator('#stage-canvas').evaluate('(c)=>c.toDataURL()')
   if page.locator('#phone-panel').is_visible(): page.locator('#phone-close').click()
   page.locator('#phone-next').click();page.wait_for_timeout(200)
   assert [x['zoom'] for x in measure(page)]==[1,1.2]
   page.locator('#phone-prev').click();page.wait_for_timeout(200)
   # Modal centre and return path.
   for key in ['info','settings','scene-list','scene-info']:
    menu(page); page.locator('#phone-'+key).click()
    if key=='scene-info' and page.locator('#phone-scene-info').get_attribute('aria-disabled')=='true': continue
    box=page.locator('#phone-panel').bounding_box();size=page.viewport_size
    assert abs(box['x']+box['width']/2-size['width']/2)<1
    assert abs(box['y']+box['height']/2-size['height']/2)<1
    page.keyboard.press('Escape')
   page.locator('#phone-tools').click()
   assert page.locator('#study-pen').is_visible() and page.locator('#study-pen-undo').is_visible() and page.locator('#study-pen-clear').is_visible()
   assert not page.locator('#study-sticky').is_visible() and not page.locator('#study-sticky-panel').is_visible()
   screenshot(page,sample+'-'+orientation+'-draw')
   page.locator('#phone-close').click();page.locator('#phone-memo').click()
   note='UI2 自分用メモ '+sample+' '+orientation;page.locator('#study-note').fill(note);page.wait_for_timeout(500)
   stored=page.evaluate("() => Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))")
   assert all(k.startswith('stage-study-') for k in stored)
   assert any(note in val for val in stored.values())
   page.reload();ready(page);page.locator('#phone-memo').click();assert page.locator('#study-note').input_value()==note;page.locator('#phone-close').click()
   # Rotate all three choices and verify mapping; touch screen short side stays 390.
   for v in ['front','plan','both']:
    view(page,v)
    page.set_viewport_size({'width':844 if portrait else 390,'height':390 if portrait else 844});page.wait_for_timeout(200)
    assert page.locator('#study-view').input_value()==('plan' if v=='plan' else 'front')
    page.set_viewport_size({'width':390 if portrait else 844,'height':844 if portrait else 390});page.wait_for_timeout(200)
   f=frame(page)
   # Seat selection survives new overlay controls.
   view(page,'front')
   if not portrait: f.locator('[data-viewer-controls=front]').click()
   opts=f.locator('#viewer-seat option').evaluate_all('(es)=>es.map(e=>e.value)')
   f.locator('#viewer-seat').select_option(opts[1]);assert f.evaluate('window.SHOSAI_STAGE_STUDY_RENDERER.camera().seat')==opts[1]
   f.locator('#viewer-seat').select_option('center')
   row['regression']='passed';results.append(row);ctx.close()
 b.close()
assert not errors,errors
assert all(r['url'].startswith('http://127.0.0.1:8981/') and r['method']=='GET' for r in requests),requests
(OUT/'results.json').write_text(json.dumps({'cases':results,'consoleErrors':errors,'requests':len(requests)},ensure_ascii=False,indent=2))
print(json.dumps({'cases':len(results),'consoleErrors':errors,'requests':len(requests)},ensure_ascii=False))
