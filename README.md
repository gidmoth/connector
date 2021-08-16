# connector

**WARNING: This is under developement  at the moment:**
**The README is outdated. Please use only  if you understand**
**the code. This Warning will disapear as soon as that changes.**

## About

This is the middleware part of [freeswitch-connector](https://github.com/gidmoth/freeswitch-connector). For general Information on Installation and usage please refer to the README therein. Connector is a nodejs program to help utilize freeswitch as a conferencing system. You can also find an example client using the API it provides [here](https://github.com/gidmoth/fsconcli).

As described in the README [here](https://github.com/gidmoth/freeswitch-connector), connector separates access to it's API based on the context of a user in freeswitchs directory. Also, connector provides a http API as well as a WebSocket, therfore the following reference is devided by http vs WebSocket, and inside both by the three contexts: team, friends and public.

## API Reference

All access to the http interface is restricted by http digest auth. So to connect with curl you'll have to do it like this for GET requests:

`curl --digest -u user:pass https://your.web.origin/url`

and for POST requests like this:

`curl --digest -u user:pass --header "Content-Type: application/json" -X POST --data '{"something":"json"}' https://your.web.origin/url`

All POST endpoints are validated against a JSON schema, for brevity the schema is given in the following for each case.

The WebSocket also utilizes auth by user and password. So to test it in your browser console you'll have to do something like this:

```
const Sock = new WebSocket('wss://your.web.origin/api/live?login=user:pass')
Sock.onmessage = (data) => {console.log(data)}
Sock.send(JSON.stringify({req:'init'}))
```

with the shown parameter to the request: `?login=user:pass`.

### HTTP

#### team

##### Userfunctions

###### `GET: /api/users`

returns JSON with all users like this:

```
{
    "op": "users",
    "info": {
        "total": 8,
        "contexts": {
            "team": 3,
            "friends": 3,
            "public": 2
        }
    },
    "users": [
        {
            "id": "20000",
            "password": "napw",
            "conpin": "2357",
            "context": "team",
            "name": "teamuser1",
            "email": "teamuser1@example.com",
            "polymac": "none"
        }, ...
    ]
}
```

###### `GET: /api/users/[byid|byname|bycontext|bypolymac]/*yourstring*`

Uses the given string to match the userarray against it. The matching
is done with the stringmethod `.startsWith()`. So those Endpoints return an array, if more than one match is found (the given string for a polycom mac may be, e.g.,
`0004f`, which will match all users with polycoms), the array contains more than
one user.

The answers look like this:

`{op: 'users/byid/yourstring', users: [{user},{user}...]}`

###### `GET: /api/users/byemail/*yourstring*`

The same as the endpoints aboth. But the email property is matched with the
`.includes()` method, to be able to match all users in the same maildomain.

The answer looks like this:

`{op: 'users/byemail/yourstring', users: [{user},{user}...]}`

###### `GET: /api/users/match/*yourstring*`

Matches `yourstring` against all emails and all names, checks if any
of them includes your string. The answer looks like this:

`{op: 'users/match/yourstring', namematches: [{user},{user}...], emailmatches: [{user},{user}...]}`

###### `POST: /api/users/add`

Schema:

```
{
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'gidmoth/userAddSchema',
        body: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    password: { type: 'string' },
                    conpin: { type: 'string' },
                    context: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                    polymac: { type: 'string' }
                },
                required: ['name', 'email', 'context'],
                additionalProperties: false
            }
        }
    }
```

As you can see, you can add multiple users at once, as long as
they fit in the dialplan. See the example dialplan in
[freeswitch-connector](https://github.com/gidmoth/freeswitch-connector).

The Answer looks like this:

`{ op: 'users/add', done: [], failed: [] }`

with the done and failed arrays filled or not. Adding a user fails
if no formal email is given, if the name is already taken, or if the
context you try to add him/her does not exists.

Ids, which are the same as the phonenumbers in freeswitch, are assigned
automatically.

###### `POST: /api/users/mod`

Schema:

```
{
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'gidmoth/userModSchema',
        body: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    password: { type: 'string' },
                    conpin: { type: 'string' },
                    context: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                    polymac: { type: 'string' }
                },
                required: ['id'],
                additionalProperties: false
            }
        }
    }
```

Modifies existing users. Only the id is required, all other
values are filled in from the existing user if they are not
provided. Except for the polymac and the password.
The polymac will be set to the default, `none`, if not provided,
and the provisioning for polycom-phones will be deletet. If no
password is provided, a new one will be generated.

If you change a users context, he will get a new id (phonenumber).
If you don't change the context, he/she will keep his/her id.

The answer looks like this:

`{ op: 'users/mod', done: [], failed: [] }`

with users filled in the arrays or not. Modding a user fails if
the id does not exist, or the new email is not a formal email, or
the new context does not exist.

###### `POST: /api/users/del`

Schema:

```
{
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'gidmoth/userDelSchema',
        body: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' }
                },
                required: ['id'],
                additionalProperties: false
            }
        }
    }
```

Deletes all users by the ids (phonenumbers) given in the array.
All provisioning for those users will also be deleted.

The answer looks like this:

`{ op: 'users/del', done: [], failed: [] }`

with the arrays filled or not. Deleting users fails if the id is not
found.

###### `GET: /api/users/rebuild`

Rebuilds all userfiles in the directory from the internal xml state.
Useful if you make changes to the userfiles in the
templates.

The answer looks like this:

`{ op: 'users/rebuild', done: [], failed: [] }`

Nothing should fail in this operation, so only the done array should
contain users.

###### `GET: /api/users/reprov`

Reprovisions all users from the internal xml state.
Useful if you make changes to the userfiles in the
templates or if you move your installation or do a fresh install with the default user, which has no provisioningfiles.

Answer:

`{ op: 'users/reprov', done: [], failed: [] }`

Nothing should fail in this operation, so only the done array should
contain users.

##### Conference Functions

###### `GET: /api/conferences`

Returns JSON with a List of all conferences like that:

```
{
    "op": "conferences",
    "info": {
        "total": 4,
        "contexts": {
            "team": 2,
            "friends": 1,
            "public": 1
        },
        "types": [
            "16kHz-novideo",
            "48kHz-video"
        ]
    },
    "conferences": [
        {
            "num": "30000",
            "name": "team_g722",
            "type": "16kHz-novideo",
            "context": "team"
        }, ...
    ]
}
```

###### `GET: /api/conferences/rebuildcontacts`

Rebuilds the contacts that are provisioned to linphone and polycom clients.

Contacts are only provisioned for conferences, not for the users.

Rebuilding those is a somewhat expensive operation, since Linphone can't be provisioned
with contacts by a file besides it's whole configuration. So all Linphone
provisioning is rebuilt by this opertation. (The alternative: calculate
all provisioning for Linphone when requested, would be even more expensive,
since provisioning should be more often requested than changes in the contacts
take place.) The polycoms are special in directory-provisioning too, so there
is the need to write a file for every phone, change it, but leave the individual
entries therein intact.

So don't forget to run this
endpoint after you add, mod, or delete conferences.

The answer looks like this:

`{op: 'conferences/rebuildcontacts', done: `${new Date()}`}`

If you try connector with the
[example config](https://github.com/gidmoth/freeswitch-connector)
you should run this endpoint to fill the contacts lists initially.

###### `GET: /api/conferences/[bynum|bytype|byname|bycontext]/*yourstring*`

Functions to filter the conference array. matching is done with the
stringmethod `.startsWith()`, which is useful or not, depending on your
naming conventions.

The answer looks like this:

`{op: 'conferences/byname/yourstring', conferences: [{conf},...]}`

###### `POST: /api/conferences/add`

Schema:

```
{
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'gidmoth/confAddSchema',
        body: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    context: { type: 'string' },
                },
                required: ['type', 'context', 'name'],
                additionalProperties: false
            }
        }
    }
```

Adds conferences to the System. As you can see, you can add
more than one conference at a time.

The answer looks like this:

`{ op: 'conferences/add', done:[], failed:[] }`

With the arrays filled with conference objects or not. Adding a
conference fails if the name is already taken, the context does not
exist, or the type of conference is not implementet as profile
in freeswitchs `conference.conf.xml`. At the moment names with spaces produce unhandled errors later, so to be safe use `_` instead of spaces.

Remember to run `GET: /api/conferences/rebuildcontacts` after
changes to conferences, if you wish the provisioned contacts
lists updated.

###### `POST: /api/conferences/del`

Schema:

```
{
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'gidmoth/confDelSchema',
        body: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    num: { type: 'string' }
                },
                required: ['num'],
                additionalProperties: false
            }
        }
    }
```

Deletes conferences by the num property, that is the number
of the conference in the dialplan. You can bulk-delete conferences.

The answer looks like this:

`{ op: 'conferences/del', done:[], failed:[] }`

Deleting a conference will fail if a conference with the requested
number is not found.

Remember to run `GET: /api/conferences/rebuildcontacts` after
changes to conferences, if you wish the provisioned contacts
lists updated.

###### `POST: /api/conferences/mod`

Schema:

```
$schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'gidmoth/confAddSchema',
        body: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    num: { type: 'string' },
                    name: { type: 'string' },
                    type: { type: 'string' },
                    context: { type: 'string' },
                },
                required: ['num'],
                additionalProperties: false
            }
        }
```

Modify conferences. If you give only the number there
will be no effect except a rebuild of the file in the dialplan.
It normally makes no sense, in contrast to the usermod interface,
where a user only modded by providing his/her id will get a new
password and the polycom provisioning will be deleted. But if you change the conference templates you can rebuild a conference with the new template by only giving the number to this endpoint.

The Answer looks like this:

`{ op: 'conferences/del', done:[], failed:[] }`

With the arrays filled or not. Modding a conference fails if the
conference (by its `num` property) does not exist, the new context
does not exist, the new type is not implementet in freeswitchs
`conferences.conf.xml`, or the new name is already taken by another
conference. The modded conference will keep it's number unless
you change the context, then it will get a new number.

Remember to run `GET: /api/conferences/rebuildcontacts` after
changes to conferences, if you wish the provisioned contacts
lists updated.

##### Functions for recordings (of conferences)

Recordings are one feature that depends on implementation not only
in connector, but also in freeswitch. To see a working example look at the
[example freeswitch configuration](https://github.com/gidmoth/freeswitch-connector), especilly
the moderator-controls in `conference.conf.xml`. Connector will track the custom
events provided by these controls, and make freeswitch do recordings
accordingly. You will also need to setup a volume for the recordings.

###### `GET: /api/recordings`

Lists filenames of recordings. The answer looks like this:

`{ op: 'api/recordings', files: [] }`

###### `GET: /api/recordings/*file*`

Download the recording. By default these are `.wav` files with a timestamp in
their name like this:

`friends_16kHz-2021-01-19T13:21:36.840Z.wav`

and the timestamp marks the beginning of the record.

###### `GET: /api/recordings/find/*string*`

Checks the available recordings for `string` in their filename. This uses
the stringmethod `.includes()` so you can search for names of conferences or
dates or both.

The answer looks like this:

`{ op: api/recordings/find/string, files: [] }`

with files filled or not.

###### `POST: /api/recordings/del`

Schema:

```
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
```

Deletes recordings by their filenames. The answer looks like this:

`{ op: 'api/recordings/del', done: [], failed: [] }`

Deleting a recording fails if the filename does not exist.

##### Functions to maintain the system

All paths mentioned in the following refer to the defaults as provided
in the installation instructions
[here](https://github.com/gidmoth/freeswitch-connector).

###### `GET: /api/store/[directory|dialplan|conferences|freeswitch]`

Stores a gzipped tar of the requested folder in `/static/store`.
The folders are respectively:

* freeswitch: `/etc/freeswitch` (the path you mountet your freeswitchs configuration)
* dialplan: `/etc/freeswitch/dialplan`
* conferences: `/etc/freeswitch/dialplan/conferences`
* directory: `/etc/freeswitch/directory`

Other folders are not implementet. This is not meant as a backup, but
more to hook in a backup conveniently or to move to a new host with ease.
These are file operations, they don't involve the internal xml state.
So It's also for testing changes in the templates
or by hand, and being able to restore with the following endpoint.

The answer looks like this:

`{ op: 'store/directory', done: '', failed: '' }`

Although this operation should never fail.

###### `GET: /api/restore/[directory|dialplan|conferences|freeswitch]`

Restores the respective directory in `/etc-freeswitch` from a previously
stored tarball in `/static/store`. After restoring this endpoint causes
a reloadxml in freeswitch and rebuilds the internal xml state of connector.

If you do this, don't forget to run `/api/users/reprov` afterwards, or the
provisioningfiles may be inconsistent with the contents of your directory.

The answer looks like this:

`{ op: 'restore/directory', done: '', failed: '' }`

Restoring fails if it could not find the tarball.

###### `GET: /api/info`

Returns some metainfo about connector and the global variables of
freeswitch. The answer looks like this:

```
{
    "op": "info",
    "info": {
        "reloadxml": {
            "lastrun": "not till now",
            "lastmsg": "no Message"
        },
        "maintainance": {
            "lastrun": "2021-01-15T15:01:46.560Z"
        }
    },
    "globals": {
        "hostname": "host.example.com",
        "local_ip_v4": "46.4.114.220",
        ...
    }
}
```

###### `GET: /api/info/state`

Returns the whole xmlState of connector, the answer looks like
this:

```
{
    "op": "info/state",
    "state": {
        "info": {
            "reloadxml": {
                "lastrun": "not till now",
                "lastmsg": "no Message"
            },
            "maintainance": {
                "lastrun": "2021-01-15T15:01:46.560Z"
            }
        },
        "globals": {
            "hostname": "host.example.com",
            "local_ip_v4": "11.12.13.14",
            ...

        },
        "users": [
            {
                "id": "20000",
                "password": "napw",
                "conpin": "2357",
                "context": "team",
                "name": "teamuser1",
                "email": "teamuser1@example.com",
                "polymac": "none"
            },
            ...
        ],
        "conferencetypes": [
            "16kHz-novideo",
            "48kHz-video"
        ],
        "conferences": [
            {
                "num": "30000",
                "name": "team_g722",
                "type": "16kHz-novideo",
                "context": "team"
            },
            ...
        ]
    }
}
```

#### friends

##### xmlState info

###### `GET: /friendxml`

returns a reduced version of the xmlState like this:

```
{
    "op": "info/state",
    "state": {
        "info": {
            "reloadxml": {
                "lastrun": "not till now",
                "lastmsg": "no Message"
            },
            "maintainance": {
                "lastrun": "2021-01-15T15:01:46.560Z"
            }
        },
        "globals": {
            "hostname": "host.example.com",
            "local_ip_v4": "11.12.13.14",
            ...

        },
        "users": [
            {
                "id": "20000",
                "context": "team",
                "name": "teamuser1",
                "email": "teamuser1@example.com",
            },
            ...
        ],
        "conferencetypes": [
            "16kHz-novideo",
            "48kHz-video"
        ],
        "conferences": [
            {
                "num": "31000",
                "name": "friends_g722",
                "type": "16kHz-novideo",
                "context": "team"
            },
            ...
        ]
    }
}
```

Users in the friendscontext don't get informations regarding conferences in the team contex. 




### WebSocket

#### team

#### friends

#### public