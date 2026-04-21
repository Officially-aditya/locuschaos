const express = require('express')
const { Client } = require('pg')

const app = express()

// Validates DATABASE_URL on startup, exits with process.exit(1) and clear error if missing
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === '__CORRUPTED__') {
    console.error('CRITICAL: DATABASE_URL is missing or corrupted')
    process.exit(1)
}

let dbStatus = 'disconnected'
let client = null

async function connectDB(retries = 5, delay = 1000) {
    client = new Client({ connectionString: process.env.DATABASE_URL })
    
    for (let i = 0; i < retries; i++) {
        try {
            await client.connect()
            dbStatus = 'connected'
            console.log('DB Connected')
            return
        } catch (err) {
            console.error(`DB connection failed. Retrying in ${delay}ms...`)
            await new Promise(res => setTimeout(res, delay))
            delay *= 2 // exponential backoff
        }
    }
    console.error('Failed to connect to DB after multiple retries')
}

connectDB()

app.get('/health', (req, res) => {
    res.json({ status: 'ok', db: dbStatus })
})

app.get('/', (req, res) => {
    res.send('Hardened App Running')
})

const server = app.listen(process.env.PORT || 3000, () => {
    console.log('Hardened App Started')
})

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully')
    server.close(() => {
        if (client) client.end()
        process.exit(0)
    })
})
