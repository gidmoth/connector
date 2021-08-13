const fsConf = require('../config').getConfig('freeswitch')
const fs = require('fs')

async function friendsrecr(fastify, options) {
    fastify.register(require('fastify-static'), {
        root: fsConf.recordings,
        prefix: '/fr/',
        serve: false
    })

    // Schema
    const recDelSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'gidmoth/recDelSchema',
        body: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    file: { type: 'string' }
                },
                required: ['file'],
                additionalProperties: false
            }
        }
    }

    fastify.get('/fr/friendsrec', async function (req, reply) {
        if (req.user.context === 'public') {
            reply.code(401)
            return reply.send({ error: 'wrong context' })
        }
        let answer = { op: 'friendserc', files: [] }
        fs.readdirSync(fsConf.recordings).forEach(file => {
            let ctx = fastify.xmlState.conferences.filter(conf => {
                return conf.name === file.split('-')[0]
            })[0].context
            // console.log(`GOT RECCONTEXT: ${ctx}`)
            if (ctx !== 'team') {
                answer.files.push(file)
            }
        })
        return answer
    });

    fastify.post('/fr/delfriendsrec', { schema: recDelSchema }, async function (req, reply) {
        if (req.user.context === 'public') {
            reply.code(401)
            return reply.send({ error: 'wrong context' })
        }
        let answer = { op: 'delfriendsrec', done: [], failed: [] }
        req.body.forEach(file => {
            try {
                fs.unlinkSync(`${fsConf.recordings}/${file.file}`)
                answer.done.push(file.file)
            } catch (error) {
                answer.failed.push(file.file)
            }
        })
        return answer
    })

    fastify.get('/fr/friendsrec/:file', async function (req, reply) {
        if (req.user.context === 'public') {
            reply.code(401)
            return reply.send({ error: 'wrong context' })
        }
        return reply.sendFile(`${req.params.file}`)
    })
}

module.exports = friendsrecr