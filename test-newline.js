const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')
const fs = require('fs')

try {
  const loraBoldBuf = fs.readFileSync('public/fonts/Lora-Bold.ttf')
  GlobalFonts.register(loraBoldBuf, 'LoraBoldCustom')
  
  const canvas = createCanvas(400, 200)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, 400, 200)
  ctx.fillStyle = 'black'
  
  ctx.font = '30px LoraBoldCustom'
  ctx.fillText('Test with newline\n', 10, 50)
  ctx.fillText('Test with return\r', 10, 100)
  
  fs.writeFileSync('test-newline.png', canvas.toBuffer('image/png'))
  console.log('Wrote test-newline.png')
} catch (e) {
  console.error(e)
}
