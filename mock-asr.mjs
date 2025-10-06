import express from 'express'
import multer from 'multer'
const app = express()
const upload = multer()
app.post('/transcribe', upload.single('file'), async (req, res) => {
  // Return dummy text so we can verify the end-to-end pipeline
  res.json({ text: 'mock transcription: private mic working ✅' })
})
app.listen(8080, () => console.log('mock ASR on http://127.0.0.1:8080/transcribe'))
