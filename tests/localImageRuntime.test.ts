import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from '../src/tools/ToolRegistry.ts'
import { registerImageTools } from '../src/images/assistantImageTools.ts'
import { IMAGE_PERMISSION_KEY, imageEndpoint, saveImageEndpoint, localImageRuntime, generatePermittedImage } from '../src/images/LocalImageRuntime.ts'

test('Windows workbench and Anne share persisted endpoint, readiness and OFF permission', async () => {
  const saved = new Map<string,string>();const calls: Array<{command:string;endpoint?:string}>=[]
  Object.assign(globalThis, {isTauri:true,localStorage:{getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>saved.set(key,value)},window:{__TAURI_INTERNALS__:{invoke:async(command:string,args:{endpoint?:string})=>{calls.push({command,...args});if(command==='crownkeep_image_status')return {state:'ready',backend:'WindowsWebUIImageRuntime',detail:'Ready'};throw new Error('generation test sentinel')}}}})
  saveImageEndpoint('http://127.0.0.1:7861');assert.equal(imageEndpoint(),'http://127.0.0.1:7861')
  assert.throws(()=>saveImageEndpoint('http://example.com'));assert.equal(imageEndpoint(),'http://127.0.0.1:7861')
  const registry=new ToolRegistry();registerImageTools(registry,()=>[])
  assert.deepEqual(await registry.availableDefinitions(),[]);assert.equal(calls.length,0)
  await assert.rejects(generatePermittedImage('crown'),/OFF/);assert.equal(calls.length,0)
  saved.set(IMAGE_PERMISSION_KEY,'on');registry.setPolicy({allowImageGeneration:true})
  assert.equal((await registry.availableDefinitions())[0]?.id,'image.generate')
  assert.equal((await localImageRuntime().status()).state,'ready')
  await assert.rejects(registry.execute('image.generate',{prompt:'crown'}),/sentinel/)
  assert.ok(calls.some(x=>x.command==='crownkeep_generate_image'))
  assert.ok(calls.every(x=>x.endpoint==='http://127.0.0.1:7861'))
  saved.set(IMAGE_PERMISSION_KEY,'off')
  assert.deepEqual(await registry.availableDefinitions(),[])
})
