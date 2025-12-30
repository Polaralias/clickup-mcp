import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'

describe('Proxy Trust Configuration', () => {
    // We cannot easily test the 'app.set("trust proxy")' logic of the *actual* server file
    // without spinning up the full server, but we can verify that Express behaves as expected
    // with this setting, effectively documenting the intended behavior and ensuring no regression
    // if we were to wrap this logic in a factory function in the future.

    // However, to be more robust, we will verify the behavior on a fresh express app configured
    // exactly like our server.

    it('should respect X-Forwarded-Proto when trust proxy is enabled', async () => {
        const app = express()
        app.set('trust proxy', true)

        app.get('/test-protocol', (req, res) => {
            res.json({ protocol: req.protocol })
        })

        const response = await request(app)
            .get('/test-protocol')
            .set('X-Forwarded-Proto', 'https')

        expect(response.body.protocol).toBe('https')
    })

    it('should respect X-Forwarded-Host when trust proxy is enabled', async () => {
        const app = express()
        app.set('trust proxy', true)

        app.get('/test-host', (req, res) => {
            res.json({ hostname: req.hostname })
        })

        const response = await request(app)
            .get('/test-host')
            .set('X-Forwarded-Host', 'my-custom-domain.com')

        expect(response.body.hostname).toBe('my-custom-domain.com')
    })

    it('should respect X-Forwarded-For when trust proxy is enabled', async () => {
         const app = express()
        app.set('trust proxy', true)

        app.get('/test-ip', (req, res) => {
            res.json({ ip: req.ip })
        })

        const response = await request(app)
            .get('/test-ip')
            .set('X-Forwarded-For', '10.0.0.5, 12.34.56.78')

        // When trusting proxy, it should take the left-most IP
        expect(response.body.ip).toBe('10.0.0.5')
    })

    it('should default to http protocol without headers', async () => {
        const app = express()
        app.set('trust proxy', true)

        app.get('/test-protocol', (req, res) => {
            res.json({ protocol: req.protocol })
        })

        const response = await request(app)
            .get('/test-protocol')

        expect(response.body.protocol).toBe('http')
    })
})
