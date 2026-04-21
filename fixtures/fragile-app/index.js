const express = require('express')
const { Client } = require('pg')

const app = express()

// Reads DATABASE_URL without validation — hangs if malformed
// No retry on DB connect — crashes silently if DB is down
const client = new Client({
    connectionString: process.env.DATABASE_URL
})
client.connect() // No .catch or retry

// No /health endpoint

app.get('/', async (req, res) => {
    res.send('Fragile App Running')
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Fragile App Started')
})
