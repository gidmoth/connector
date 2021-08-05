/**
 * Websocket connection to propagate liveState
 */


const fastiConf = require('../config').getConfig('fasti');
const confCtrl = require('../fseventusers/confctrlfuncts');
const record = require('../fseventusers/recordingfuncts')
const freeswitchparams = require('../config').getConfig('freeswitch')
const recpath = freeswitchparams.recordings
const muteall = require('../fseventusers/muteallfunc')

function noop() { }

function heartbeat() {
    this.isAlive = true;
}

function checkCreds(cstring, arr) {
    let user = arr.filter(usr => { return usr.name === `${cstring.split(':')[0]}` })[0]
    if (user !== undefined
        && user.password === `${cstring.split(':')[1]}`) {
        return true
    }
    return false
}

function selectSend(client, confarr, conf, msg) {
    let myctx = confarr.filter(cnf => cnf.name === conf)[0].context
    switch (myctx) {
        case 'public': {
            client.send(msg)
            break;
        }
        case 'friends': {
            if (client.ctx !== 'public') {
                client.send(msg)
            }
            break;
        }
        case 'team': {
            if (client.ctx === 'team') {
                client.send(msg)
            }
            break;
        }
    }
}

async function liveroutes(fastify, options) {

    fastify.register(require('fastify-websocket'), {
        options: {
            clientTracking: true,
        }
    })

    fastify.after(() => {
        fastify.websocketServer.on('connection', (client, req) => {
            let user = fastify.xmlState.users.filter(usr => {
                return usr.password === `${req.url.split(':')[1]}`
            })[0]
            client.ctx = user.context
            //console.log(`NEW CLIENT: ${user.context}`)
        })
    })

    const interval = setInterval(() => {
        fastify.websocketServer.clients.forEach(sock => {
            if (sock.isAlive === false) {
                console.log('destroying unresponsive client')
                return sock.terminate()
            }
            sock.isAlive = false
            sock.ping(noop)
        })
    }, 30000)

    /* fastify.websocketServer.on('close', () => {
        clearInterval(interval)
    }) */

    fastify.addHook('onRequest', (conn, repl, done) => {
        if (conn.query.login === undefined) {
            conn.socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
            conn.socket.destroy()
            return repl.send('Unauthorized')
        }
        if (!checkCreds(conn.query.login, fastify.xmlState.users)) {
            conn.socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
            conn.socket.destroy()
            return repl.send('Unauthorized')
        }
        done()
    })

    fastify.xmlState.on('newXML', () => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(`{"event":"newXML"}`)
            }
        })
    })

    fastify.liveState.on('newLiveState', () => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                switch (client.ctx) {
                    case 'team': {
                        client.send(`{"event":"newLiveState","data":${JSON.stringify(fastify.liveState.conferences)}}`)
                        break;
                    }
                    case 'friends': {
                        let filtered = fastify.liveState.conferences.filter(cnf => { return cnf.context !== 'team' })
                        client.send(`{"event":"newLiveState","data":${JSON.stringify(filtered)}}`)
                        break;
                    }
                    case 'public': {
                        let filtered = fastify.liveState.conferences.filter(cnf => { return cnf.context === 'public' })
                        client.send(`{"event":"newLiveState","data":${JSON.stringify(filtered)}}`)
                        break;
                    }
                }
            }
        })
    })

    fastify.liveState.on('newConference', (data) => {
        fastify.websocketServer.clients.forEach(client => {
            //console.log(`SEND TO: ${client.ctx}`)
            if (client.readyState === 1) {
                switch (data.context) {
                    case 'public': {
                        client.send(`{"event":"newConference","data":${JSON.stringify(data)}}`)
                        break;
                    }
                    case 'friends': {
                        if (client.ctx !== 'public') {
                            client.send(`{"event":"newConference","data":${JSON.stringify(data)}}`)
                        }
                        break;
                    }
                    case 'team': {
                        if (client.ctx === 'team') {
                            client.send(`{"event":"newConference","data":${JSON.stringify(data)}}`)
                        }
                        break;
                    }
                }
            }
        })
    })

    fastify.liveState.on('newMember', (conf, mem) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"newMember","conference":"${conf}","data":${JSON.stringify(mem)}}`)
            }
        })
    })

    fastify.liveState.on('floorchange', (conf, mem) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"floorchange","conference":"${conf}","data":${JSON.stringify(mem)}}`)
            }
        })
    })

    fastify.liveState.on('unmute', (conf, memconfid) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"unmute","conference":"${conf}","data":"${memconfid}"}`)
            }
        })
    })

    fastify.liveState.on('mute', (conf, memconfid) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"mute","conference":"${conf}","data":"${memconfid}"}`)
            }
        })
    })

    fastify.liveState.on('muteAll', (conf) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"muteAll","conference":"${conf}"}`)
            }
        })
    })

    fastify.liveState.on('recStop', (conf) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"recStop","conference":"${conf}"}`)
            }
        })
    })

    fastify.liveState.on('recResume', (conf, file) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"recResume","conference":"${conf}","file":"${file}"}`)
            }
        })
    })

    fastify.liveState.on('recPause', (conf, file) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"recPause","conference":"${conf}","file":"${file}"}`)
            }
        })
    })

    fastify.liveState.on('recStart', (conf, file) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"recStart","conference":"${conf}","file":"${file}"}`)
            }
        })
    })

    fastify.liveState.on('delConference', (conf) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"delConference","conference":"${conf}"}`)
            }
        })
    })

    fastify.liveState.on('delMember', (conf, memconfid) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"delMember","conference":"${conf}","data":"${memconfid}"}`)
            }
        })
    })

    fastify.liveState.on('lock', (conf) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"lock","conference":"${conf}"}`)
            }
        })
    })

    fastify.liveState.on('unlock', (conf) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                selectSend(client, fastify.liveState.conferences, conf, `{"event":"unlock","conference":"${conf}"}`)
            }
        })
    })

    fastify.liveState.on('addReg', (usr) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(`{"event":"addReg","user":${JSON.stringify(usr)}}`)
            }
        })
    })

    fastify.liveState.on('delReg', (usr) => {
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(`{"event":"delReg","user":${JSON.stringify(usr)}}`)
            }
        })
    })

    fastify.get('/api/live', { websocket: true }, (conn, req) => {
        conn.socket.on('open', heartbeat)
        conn.socket.on('pong', heartbeat)
        conn.socket.on('message', message => {
            try {
                let msg = JSON.parse(message)
                if (msg.req === undefined) {
                    conn.socket.send(`{"event":"error","error":"wrong protocol"}`)
                    return
                }
                switch (msg.req) {
                    case 'init': {
                        //console.log(`GOT INITREQ FROM: ${conn.socket.ctx}`)
                        switch (conn.socket.ctx) {
                            case 'team': {
                                conn.socket.send(`{"event":"reply","reply":"init","data":${JSON.stringify(fastify.liveState.conferences)}}`)
                                break;
                            }
                            case 'friends': {
                                let filtered = fastify.liveState.conferences.filter(cnf => { return cnf.context !== 'team' })
                                conn.socket.send(`{"event":"reply","reply":"init","data":${JSON.stringify(filtered)}}`)
                                break;
                            }
                            case 'public': {
                                let filtered = fastify.liveState.conferences.filter(cnf => { return cnf.context === 'public' })
                                conn.socket.send(`{"event":"reply","reply":"init","data":${JSON.stringify(filtered)}}`)
                                break;
                            }
                        }
                        break
                    }
                    case 'initreg': {
                        conn.socket.send(`{"event":"reply","reply":"initreg","data":${JSON.stringify(fastify.liveState.registrations)}}`)
                        break
                    }
                    case 'exec': {
                        if (conn.socket.ctx === 'public') {
                            console.log('PUBEXREQ!')
                            conn.socket.send('HTTP/1.1 401 Unauthorized\r\n\r\n')
                            conn.socket.close()
                            return
                        }
                        if (msg.conference === undefined) {
                            conn.socket.send(`{"event":"error","error":"wrong protocol"}`)
                            return
                        }
                        if (msg.call === undefined) {
                            conn.socket.send(`{"event":"error","error":"wrong protocol"}`)
                            return
                        }
                        let conference = msg.conference
                        let call = msg.call
                        switch (call) {
                            case 'lock': {
                                confCtrl.confLock(conference)
                                    .then(ans => {
                                        console.log(ans)
                                    })
                                    .catch(err => {
                                        conn.socket.send(`{"event":"error","error":"${err}"}`)
                                    })
                                break;
                            }
                            case 'unlock': {
                                confCtrl.confUnlock(conference)
                                    .then(ans => {
                                        console.log(ans)
                                    })
                                    .catch(err => {
                                        conn.socket.send(`{"event":"error","error":"${err}"}`)
                                    })
                                break;
                            }
                            case 'startrec': {
                                let filename = `${recpath}/${conference}-${new Date().toISOString()}.wav`
                                record.startrec(conference, filename)
                                    .then(answer => {
                                        console.log(answer)
                                    })
                                    .catch(err => {
                                        console.log(err)
                                    })
                                break;
                            }
                            case 'pauserec': {
                                let posi = fastify.liveState.conferences.findIndex(conf => conf.name === conference)
                                let filename = fastify.liveState.conferences[posi].recording.file
                                record.pauserec(conference, filename)
                                    .then(answer => {
                                        console.log(answer)
                                    })
                                    .catch(err => {
                                        console.log(err)
                                    })
                                break;
                            }
                            case 'resumerec': {
                                let posi = fastify.liveState.conferences.findIndex(conf => conf.name === conference)
                                let filename = fastify.liveState.conferences[posi].recording.file
                                record.resumerec(conference, filename)
                                    .then(answer => {
                                        console.log(answer)
                                    })
                                    .catch(err => {
                                        console.log(err)
                                    })
                                break;
                            }
                            case 'stoprec': {
                                let posi = fastify.liveState.conferences.findIndex(conf => conf.name === conference)
                                let filename = fastify.liveState.conferences[posi].recording.file
                                record.stoprec(conference, filename)
                                    .then(answer => {
                                        console.log(answer)
                                    })
                                    .catch(err => {
                                        console.log(err)
                                    })
                                break;
                            }
                            case 'muteall': {
                                muteall.run(conference)
                                    .then(answer => {
                                        console.log(answer)
                                    })
                                    .catch(err => {
                                        console.log(err)
                                    })
                                break;
                            }
                            case 'kickall': {
                                confCtrl.confKickAll(conference)
                                    .then(ans => {
                                        console.log(ans)
                                    })
                                    .catch(err => {
                                        conn.socket.send(`{"event":"error","error":"${err}"}`)
                                    })
                                break;
                            }
                            default: {
                                conn.socket.send(`{"event":"error","error":"wrong protocol"}`)
                                return
                            }
                        }
                        break
                    }
                    case 'memexec': {
                        if (conn.socket.ctx === 'public') {
                            console.log('PUBEXREQ!')
                            conn.socket.send('HTTP/1.1 401 Unauthorized\r\n\r\n')
                            conn.socket.close()
                            return
                        }
                        if (msg.conference === undefined) {
                            conn.socket.send(`{"event":"error","error":"wrong protocol"}`)
                            return
                        }
                        if (msg.call === undefined) {
                            conn.socket.send(`{"event":"error","error":"wrong protocol"}`)
                            return
                        }
                        if (msg.member === undefined) {
                            conn.socket.send(`{"event":"error","error":"wrong protocol"}`)
                            return
                        }
                        let conference = msg.conference
                        let call = msg.call
                        let member = msg.member
                        switch (call) {
                            case 'kick': {
                                confCtrl.confKickMem(conference, member)
                                    .then(ans => {
                                        console.log(ans)
                                    })
                                    .catch(err => {
                                        conn.socket.send(`{"event":"error","error":"${err}"}`)
                                    })
                                break;
                            }
                            case 'mute': {
                                confCtrl.confMuteMem(conference, member)
                                    .then(ans => {
                                        console.log(ans)
                                    })
                                    .catch(err => {
                                        conn.socket.send(`{"event":"error","error":"${err}"}`)
                                    })
                                break;
                            }
                            case 'unmute': {
                                confCtrl.confUnmuteMem(conference, member)
                                    .then(ans => {
                                        console.log(ans)
                                    })
                                    .catch(err => {
                                        conn.socket.send(`{"event":"error","error":"${err}"}`)
                                    })
                                break;
                            }
                            default: {
                                conn.socket.send(`{"event":"error","error":"wrong protocol"}`)
                                return
                            }
                        }
                        break
                    }
                    default: {
                        conn.socket.send(`{"event":"error","error":"wrong protocol"}`)
                        break
                    }
                }
            } catch (e) {
                //console.log(e)
                conn.socket.send(`{"event":"error","error":"wrong format"}`)
            }
        })
    })
}

module.exports = liveroutes