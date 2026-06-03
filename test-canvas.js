const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')
const fs = require('fs')

try {
  const loraBoldBuf = fs.readFileSync('public/fonts/Lora-Bold.ttf')
  GlobalFonts.register(loraBoldBuf, 'LoraBoldCustom')
  console.log('Fonts registered:', GlobalFonts.families)
  
  const canvas = createCanvas(400, 200)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, 400, 200)
  ctx.fillStyle = 'black'
  
  // Test 1: LoraBoldCustom
  ctx.font = '30px LoraBoldCustom'
  ctx.fillText('Test LoraBoldCustom', 10, 50)
  
  // Test 2: Lora
  ctx.font = 'bold 30px Lora'
  ctx.fillText('Test Lora Bold', 10, 100)
  
  fs.writeFileSync('test-out.png', canvas.toBuffer('image/png'))
  console.log('Wrote test-out.png')
} catch (e) {
  console.error(e)
}
