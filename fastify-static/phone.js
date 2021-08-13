/**
 * verto communicator
 */

const provpaths = require('../config').getConfig('provisioningpaths')
const fs = require('fs')
const fsConf = require('../config').getConfig('freeswitch')

async function vcroutes(fastify, options) {
    fastify.register(require('fastify-static'), {
        root: provpaths.vertocom,
        serve: true
    })

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

    fastify.get('/userinfo', async function (req, reply) {
        let rsp = req.user
        rsp.wss_binding = fastify.xmlState.globals.wss_binding
        rsp.internal_tls_port = fastify.xmlState.globals.internal_tls_port
        return rsp
    })

    fastify.get('/friendxml', async function (req, reply) {
        // console.log(`FRIENDXMLREQ FROM: ${req.user.context}`)
        if (req.user.context === 'public') {
            reply.code(401)
            return reply.send({ error: 'wrong context' })
        }
        let answer = { op: '/friendxml' }
        answer.state = {}
        answer.state.users = fastify.xmlState.users.map(usr => {
            return ({
                name: usr.name,
                id: usr.id,
                email: usr.email,
                context: usr.context
            })
        })
        answer.state.conferences = fastify.xmlState.conferences.filter(conf => {
            return conf.context != 'team'
        })
        answer.state.conferencetypes = fastify.xmlState.conferencetypes
        return answer
    })

    fastify.get('/pubxml', async function (req, reply) {
        let answer = { op: '/pubxml' }
        answer.state = {}
        answer.state.users = fastify.xmlState.users.map(usr => {
            return ({
                name: usr.name,
                id: usr.id,
                context: usr.context
            })
        })
        answer.state.conferences = fastify.xmlState.conferences.filter(conf => {
            return conf.context === 'public'
        })
        answer.state.conferencetypes = fastify.xmlState.conferencetypes
        return answer
    })

    fastify.get('/', async function (req, reply) {
        return reply.sendFile('index.html')
    })

    fastify.get('/poster.png', async function (req, reply) {
        return reply.sendFile('poster.png')
    })
}

module.exports = vcroutes