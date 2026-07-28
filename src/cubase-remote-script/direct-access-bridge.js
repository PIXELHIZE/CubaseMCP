// AI MCP DirectAccess Bridge for Cubase/Nuendo MIDI Remote API.
// Requires Cubase/Nuendo 13+ for DirectAccess basics, Cubase/Nuendo 15 + API 1.3 for extended introspection/plugin manager.
// No OS-level keyboard, mouse, window, dialog, screenshot, or OCR automation is used.

var midiremote_api = require('midiremote_api_v1')

var deviceDriver = midiremote_api.makeDeviceDriver('OpenAI', 'AI MCP DirectAccess Bridge', 'OpenAI')
var midiInput = deviceDriver.mPorts.makeMidiInput('AI MCP Bridge To Cubase')
var midiOutput = deviceDriver.mPorts.makeMidiOutput('AI MCP Bridge From Cubase')

deviceDriver.makeDetectionUnit().detectPortPair(midiInput, midiOutput)
    .expectInputNameEquals('AI MCP Bridge To Cubase')
    .expectOutputNameEquals('AI MCP Bridge From Cubase')

var MANUFACTURER = 0x7d
var MAGIC = 'AIMCP1:'
var CHUNK_MAGIC = 'AIMCP1C:'
var MAX_SYSEX_FRAME_BYTES = 1024
var CHUNK_FRAGMENT_CHARS = 640
var MAX_LOGICAL_PAYLOAD_CHARS = 4 * 1024 * 1024
var page = deviceDriver.mMapping.makePage('AI MCP DirectAccess')
var directAccess = {}
var directAccessActivated = {}
var objectOwners = {}
var activeMappingRef = null
var activeDeviceRef = null
var commandRegistry = {}
var commandButtons = {}
var incomingChunks = {}
var subscriptions = { objects: false, parameters: {} }
var lastDirectAccessUpdateAt = 0
var bridgeState = {
    appVersion: 'unknown',
    midiRemoteApiVersion: 'unknown_feature_detected',
    projectOpen: true,
    transport: { state: 'stopped', cycleEnabled: false, metronomeEnabled: false },
    selectedTrack: { name: 'Selected Track' },
    selectedQuickControls: [],
    focusedQuickControls: []
}

var commandCandidates = [
    { key: 'track.add.audio', category: 'AddTrack', name: 'Audio', cc: 80, dialogRisk: false },
    { key: 'track.add.midi', category: 'AddTrack', name: 'MIDI', cc: 81, dialogRisk: false },
    { key: 'track.add.instrument', category: 'AddTrack', name: 'Instrument', cc: 82, dialogRisk: true },
    { key: 'track.add.group', category: 'AddTrack', name: 'Group Channel', cc: 83, dialogRisk: false },
    { key: 'track.add.fx', category: 'AddTrack', name: 'FX Channel', cc: 84, dialogRisk: true },
    { key: 'track.add.folder', category: 'AddTrack', name: 'Folder', cc: 85, dialogRisk: false },
    { key: 'track.add.marker', category: 'AddTrack', name: 'Marker', cc: 86, dialogRisk: false },
    { key: 'track.add.tempo', category: 'AddTrack', name: 'Tempo', cc: 87, dialogRisk: false },
    { key: 'track.add.chord', category: 'AddTrack', name: 'Chord', cc: 88, dialogRisk: false },
    { key: 'track.duplicate', category: 'Project', name: 'Duplicate Tracks', cc: 89, selectionDependent: true, destructive: true },
    { key: 'track.remove_selected', category: 'Project', name: 'Remove Selected Tracks', cc: 90, selectionDependent: true, destructive: true },
    { key: 'midi.quantize', category: 'Quantize Category', name: 'Quantize', cc: 91, selectionDependent: true, destructive: true },
    { key: 'audio.bounce_selection', category: 'Audio', name: 'Bounce Selection', cc: 92, selectionDependent: true, destructive: true },
    { key: 'audio.crossfade', category: 'Audio', name: 'Crossfade', cc: 93, selectionDependent: true, destructive: true },
    { key: 'audio.fade_in', category: 'Audio', name: 'Apply Standard Fade In', cc: 94, selectionDependent: true, destructive: true },
    { key: 'audio.fade_out', category: 'Audio', name: 'Apply Standard Fade Out', cc: 95, selectionDependent: true, destructive: true },
    { key: 'audio.delete_overlaps', category: 'Audio', name: 'Delete Overlaps', cc: 96, selectionDependent: true, destructive: true },
    { key: 'audio.dissolve_part', category: 'MIDI', name: 'Dissolve Part', cc: 97, selectionDependent: true, destructive: true },
    { key: 'marker.add_position_selected', category: 'Marker', name: 'Add Position Marker on Selected Track', cc: 98, selectionDependent: true, destructive: true },
    { key: 'marker.add_cycle_selected', category: 'Marker', name: 'Add Cycle Marker on Selected Track', cc: 99, selectionDependent: true, destructive: true },
    { key: 'export.perform_current_audio_export', category: 'Audio Export', name: 'Perform Audio Export', cc: 100, requiresExistingExportSettings: true, destructive: true },
    { key: 'edit.undo', category: 'Edit', name: 'Undo', cc: 101 },
    { key: 'edit.redo', category: 'Edit', name: 'Redo', cc: 102 },
    { key: 'midi.legato', category: 'MIDI', name: 'Legato', cc: 103, selectionDependent: true, destructive: true },
    { key: 'midi.fixed_length', category: 'MIDI', name: 'Fixed Lengths', cc: 104, selectionDependent: true, destructive: true },
    { key: 'marker.add_position_active', category: 'Marker', name: 'Add Position Marker on Active Track', cc: 105, selectionDependent: true, destructive: true },
    { key: 'marker.add_cycle_active', category: 'Marker', name: 'Add Cycle Marker on Active Track', cc: 106, selectionDependent: true, destructive: true },
    { key: 'track.rename_selected', category: 'Edit', name: 'Rename First Selected Track', cc: 107, selectionDependent: true, dialogRisk: true },
    { key: 'render.current_settings', category: 'Render in Place', name: 'Render (with Current Settings)', cc: 108, selectionDependent: true, destructive: true, requiresCurrentSettings: true }
]

function asciiBytes(text) {
    var bytes = []
    for (var i = 0; i < text.length; i++) {
        var code = text.charCodeAt(i)
        bytes.push(code < 128 ? code : 63)
    }
    return bytes
}

function asciiJson(value) {
    return JSON.stringify(value).replace(/[^\x00-\x7F]/g, function(character) {
        return '\\u' + ('0000' + character.charCodeAt(0).toString(16)).slice(-4)
    })
}

function checksumAscii(text) {
    var hash = 0x811c9dc5
    for (var i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i)
        hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
    }
    return ('00000000' + hash.toString(16)).slice(-8)
}

function sendFrame(magic, json) {
    var bytes = [0xf0, MANUFACTURER].concat(asciiBytes(magic + json)).concat([0xf7])
    midiOutput.sendMidi(activeDeviceRef, bytes)
}

function sendJson(id, json) {
    if (json.length > MAX_LOGICAL_PAYLOAD_CHARS) throw new Error('AIMCP payload exceeds logical payload limit')
    if (MAGIC.length + json.length + 3 <= MAX_SYSEX_FRAME_BYTES) {
        sendFrame(MAGIC, json)
        return
    }
    var checksum = checksumAscii(json)
    var transferId = String(id || 'event') + '-' + String(new Date().getTime()) + '-' + checksum
    var fragmentSize = CHUNK_FRAGMENT_CHARS
    var fragments = []
    var envelopes = []
    while (fragmentSize >= 64) {
        fragments = []
        envelopes = []
        for (var offset = 0; offset < json.length; offset += fragmentSize) fragments.push(json.substring(offset, offset + fragmentSize))
        var fits = true
        for (var index = 0; index < fragments.length; index++) {
            var envelope = {
                protocol: 'cubase-mcp-midi-chunk',
                version: 1,
                transferId: transferId,
                requestId: id,
                index: index,
                total: fragments.length,
                checksum: checksum,
                payloadLength: json.length,
                fragment: fragments[index]
            }
            var envelopeJson = asciiJson(envelope)
            if (CHUNK_MAGIC.length + envelopeJson.length + 3 > MAX_SYSEX_FRAME_BYTES) fits = false
            envelopes.push(envelopeJson)
        }
        if (fits) break
        fragmentSize -= 32
    }
    if (fragmentSize < 64) throw new Error('Unable to frame AIMCP chunked response')
    for (var chunkIndex = 0; chunkIndex < envelopes.length; chunkIndex++) sendFrame(CHUNK_MAGIC, envelopes[chunkIndex])
}

function sendProtocol(type, id, command, ok, payload, error) {
    if (!activeDeviceRef) return
    var message = {
        protocol: 'cubase-mcp-midi',
        version: 1,
        type: type,
        id: id,
        command: command,
        ok: ok,
        payload: payload,
        error: error,
        timestamp: String(new Date().toISOString())
    }
    sendJson(id, asciiJson(message))
}

function sendState() {
    sendProtocol('state', undefined, 'state', true, bridgeState, undefined)
}

function success(id, command, data) {
    sendProtocol('response', id, command, true, data, undefined)
}

function fail(id, command, code, message, extra) {
    var error = extra || {}
    error.code = code
    error.message = message
    error.cubaseApiVersion = getApiVersion()
    sendProtocol('response', id, command, true, { ok: false, requestId: id, error: error }, undefined)
}

function directResponse(id, data) {
    success(id, 'direct_access', { ok: true, requestId: id, data: data })
}

function directFail(id, code, message, extra) {
    var error = extra || {}
    error.code = code
    error.message = message
    error.cubaseApiVersion = getApiVersion()
    success(id, 'direct_access', { ok: false, requestId: id, error: error })
}

function decodeRequest(message) {
    if (!message || message.length < 4 || message[0] !== 0xf0 || message[1] !== MANUFACTURER || message[message.length - 1] !== 0xf7) return undefined
    var text = ''
    for (var i = 2; i < message.length - 1; i++) text += String.fromCharCode(message[i])
    if (text.indexOf(MAGIC) === 0) return JSON.parse(text.substring(MAGIC.length))
    if (text.indexOf(CHUNK_MAGIC) !== 0) return undefined
    var chunk = JSON.parse(text.substring(CHUNK_MAGIC.length))
    if (!chunk || chunk.protocol !== 'cubase-mcp-midi-chunk' || chunk.version !== 1) throw new Error('Invalid AIMCP chunk envelope')
    if (chunk.payloadLength < 1 || chunk.payloadLength > MAX_LOGICAL_PAYLOAD_CHARS || chunk.total < 1 || chunk.total > Math.ceil(MAX_LOGICAL_PAYLOAD_CHARS / 32)) throw new Error('AIMCP chunk exceeds logical payload limit')
    var assembly = incomingChunks[chunk.transferId]
    if (!assembly) {
        assembly = { createdAt: new Date().getTime(), total: chunk.total, checksum: chunk.checksum, payloadLength: chunk.payloadLength, fragments: {} }
        incomingChunks[chunk.transferId] = assembly
    }
    if (assembly.total !== chunk.total || assembly.checksum !== chunk.checksum || assembly.payloadLength !== chunk.payloadLength) {
        delete incomingChunks[chunk.transferId]
        throw new Error('Conflicting AIMCP chunk metadata')
    }
    if (assembly.fragments[chunk.index] !== undefined && assembly.fragments[chunk.index] !== chunk.fragment) {
        delete incomingChunks[chunk.transferId]
        throw new Error('Conflicting duplicate AIMCP chunk')
    }
    assembly.fragments[chunk.index] = chunk.fragment
    var json = ''
    for (var chunkIndex = 0; chunkIndex < assembly.total; chunkIndex++) {
        if (assembly.fragments[chunkIndex] === undefined) return undefined
        json += assembly.fragments[chunkIndex]
    }
    delete incomingChunks[chunk.transferId]
    if (json.length !== assembly.payloadLength || checksumAscii(json) !== assembly.checksum) throw new Error('AIMCP chunk checksum failed')
    var decoded = JSON.parse(json)
    if (chunk.requestId && decoded.id !== chunk.requestId) throw new Error('AIMCP chunk requestId correlation failed')
    return decoded
}

function getApiVersion() {
    try {
        return midiremote_api.mDefaults.mAppVersion.getVersionString()
    } catch (e) {
        return 'unknown'
    }
}

function inferMidiRemoteApiVersion() {
    if (!page.mHostAccess || !page.mHostAccess.makeDirectAccess) return '1.0_or_1.1_feature_detected'
    var da = findDAForObject(0)
    if (da && da.getObjectTypeName && da.getParameterProcessValueType && da.isParameterAutomatable && da.mPluginManager) return '1.3_feature_detected'
    return '1.2_feature_detected'
}

function getRootHostObject(root) {
    if (!page.mHostAccess) return undefined
    if (root === 'trackSelection') return page.mHostAccess.mTrackSelection
    if (root === 'mixConsole') return page.mHostAccess.mMixConsole
    if (root === 'focusedQuickControls') return page.mHostAccess.mFocusedQuickControls
    if (root === 'transport') return page.mHostAccess.mTransport
    return undefined
}

function ensureDirectAccess(root) {
    if (!page.mHostAccess || !page.mHostAccess.makeDirectAccess) {
        return { error: 'DIRECT_ACCESS_UNAVAILABLE' }
    }
    var hostObject = getRootHostObject(root)
    if (!hostObject) return { error: 'ROOT_OBJECT_NOT_FOUND' }
    if (!directAccess[root]) {
        directAccess[root] = page.mHostAccess.makeDirectAccess(hostObject)
        configureDirectAccessCallbacks(root, directAccess[root])
    }
    if (activeMappingRef && directAccess[root].activate && !directAccessActivated[root]) {
        directAccess[root].activate(activeMappingRef)
        directAccessActivated[root] = true
    }
    return { da: directAccess[root] }
}

function findDAForObject(objectId) {
    var owner = objectOwners[String(objectId)]
    if (owner && directAccess[owner]) return directAccess[owner]
    for (var key in directAccess) {
        if (directAccess.hasOwnProperty(key)) return directAccess[key]
    }
    var roots = ['trackSelection', 'mixConsole', 'focusedQuickControls', 'transport']
    for (var i = 0; i < roots.length; i++) {
        var created = ensureDirectAccess(roots[i])
        if (created.da) return created.da
    }
    return undefined
}

function rootForDA(da) {
    for (var root in directAccess) if (directAccess.hasOwnProperty(root) && directAccess[root] === da) return root
    return undefined
}

function configureDirectAccessCallbacks(root, da) {
    da.mOnObjectChange = function(activeDevice, activeMapping, objectId) {
        objectOwners[String(objectId)] = root
        if (subscriptions.objects) sendProtocol('event', undefined, 'direct_access_object_change', true, { root: root, objectId: objectId }, undefined)
    }
    da.mOnObjectWillBeRemoved = function(activeDevice, activeMapping, objectId) {
        delete objectOwners[String(objectId)]
        if (subscriptions.objects) sendProtocol('event', undefined, 'direct_access_object_will_be_removed', true, { root: root, objectId: objectId }, undefined)
    }
    da.mOnParameterChange = function(activeDevice, activeMapping, objectId, parameterTag) {
        objectOwners[String(objectId)] = root
        if (subscriptions.parameters[String(objectId)] || subscriptions.parameters['*']) {
            sendProtocol('event', undefined, 'direct_access_parameter_change', true, {
                root: root,
                objectId: objectId,
                parameterTag: parameterTag,
                parameter: parameter(da, objectId, parameterTag)
            }, undefined)
        }
    }
}

function callOptional(obj, method, args) {
    if (!obj || !obj[method]) return { available: false }
    try {
        return { available: true, value: obj[method].apply(obj, args) }
    } catch (e) {
        return { available: true, error: String(e) }
    }
}

function getBaseObjectId(root) {
    var resolved = ensureDirectAccess(root)
    if (resolved.error) return resolved
    var da = resolved.da
    if (da.update) {
        try { da.update(activeMappingRef) } catch (e) {}
    }
    var result = callOptional(da, 'getBaseObjectID', [activeMappingRef])
    if (!result.available) return { error: 'CUBASE_API_NOT_EXPOSED', message: 'getBaseObjectID is not available' }
    if (result.error) return { error: 'CUBASE_API_ERROR', message: result.error }
    objectOwners[String(result.value)] = root
    return { da: da, objectId: result.value }
}

function objectMetadata(da, objectId) {
    var metadata = { objectId: objectId }
    var owner = rootForDA(da)
    if (owner) objectOwners[String(objectId)] = owner
    var title = callOptional(da, 'getObjectTitle', [activeMappingRef, objectId])
    var typeName = callOptional(da, 'getObjectTypeName', [activeMappingRef, objectId])
    var unique = callOptional(da, 'getObjectUniqueIDString', [activeMappingRef, objectId])
    metadata.title = title.error ? undefined : title.value
    metadata.typeName = typeName.error ? undefined : typeName.value
    metadata.uniqueId = unique.error ? undefined : unique.value
    metadata.features = {
        getObjectTypeName: typeName.available,
        getObjectUniqueIDString: unique.available
    }
    return metadata
}

function childObjects(da, objectId) {
    var count = callOptional(da, 'getNumberOfChildObjects', [activeMappingRef, objectId])
    if (!count.available) return { error: 'CUBASE_API_NOT_EXPOSED', message: 'getNumberOfChildObjects is not available' }
    if (count.error) return { error: 'CUBASE_API_ERROR', message: count.error }
    var children = []
    for (var i = 0; i < count.value; i++) {
        var child = callOptional(da, 'getChildObjectID', [activeMappingRef, objectId, i])
        if (child.error) {
            children.push({ index: i, error: child.error })
        } else {
            children.push(objectMetadata(da, child.value))
        }
    }
    return { count: count.value, children: children }
}

function parameters(da, objectId) {
    var count = callOptional(da, 'getNumberOfParameters', [activeMappingRef, objectId])
    if (!count.available) return { error: 'CUBASE_API_NOT_EXPOSED', message: 'getNumberOfParameters is not available' }
    if (count.error) return { error: 'CUBASE_API_ERROR', message: count.error }
    var params = []
    for (var i = 0; i < count.value; i++) {
        var tag = callOptional(da, 'getParameterTagByIndex', [activeMappingRef, objectId, i])
        if (tag.error) {
            params.push({ index: i, error: tag.error })
        } else {
            params.push(parameter(da, objectId, tag.value, i))
        }
    }
    return { count: count.value, parameters: params }
}

function parameter(da, objectId, parameterTag, index) {
    var title = callOptional(da, 'getParameterTitle', [activeMappingRef, objectId, parameterTag, 256])
    var processValue = callOptional(da, 'getParameterProcessValue', [activeMappingRef, objectId, parameterTag])
    var defaultProcessValue = callOptional(da, 'getParameterDefaultProcessValue', [activeMappingRef, objectId, parameterTag])
    var displayValue = callOptional(da, 'getParameterDisplayValue', [activeMappingRef, objectId, parameterTag])
    var displayUnits = callOptional(da, 'getParameterDisplayUnits', [activeMappingRef, objectId, parameterTag])
    var valueType = callOptional(da, 'getParameterProcessValueType', [activeMappingRef, objectId, parameterTag])
    var automatable = callOptional(da, 'isParameterAutomatable', [activeMappingRef, objectId, parameterTag])
    var editLocked = callOptional(da, 'getParameterEditLockState', [activeMappingRef, objectId, parameterTag])
    var plainValue = processValue.available && !processValue.error
        ? callOptional(da, 'convertParameterProcessValueToPlain', [activeMappingRef, objectId, parameterTag, processValue.value])
        : { available: false }
    return {
        index: index,
        objectId: objectId,
        parameterTag: parameterTag,
        title: title.error ? undefined : title.value,
        processValue: processValue.error ? undefined : processValue.value,
        defaultProcessValue: defaultProcessValue.error ? undefined : defaultProcessValue.value,
        plainValue: plainValue.available && !plainValue.error ? plainValue.value : undefined,
        displayValue: displayValue.error ? undefined : displayValue.value,
        displayUnits: displayUnits.error ? undefined : displayUnits.value,
        processValueType: valueType.available && !valueType.error ? valueType.value : undefined,
        automatable: automatable.available && !automatable.error ? automatable.value : undefined,
        editLocked: editLocked.available && !editLocked.error ? editLocked.value : undefined,
        writable: !!(da && da.setParameterProcessValue) && !(editLocked.available && editLocked.value),
        features: {
            processValue: processValue.available,
            defaultProcessValue: defaultProcessValue.available,
            processValueType: valueType.available,
            automatable: automatable.available,
            processToPlain: plainValue.available,
            editLock: editLocked.available,
            processWrite: !!(da && da.setParameterProcessValue)
        }
    }
}

function discoverTree(root) {
    var base = getBaseObjectId(root)
    if (base.error) return base
    var da = base.da
    var visited = {}
    var objectCount = 0
    var truncated = false
    function walk(objectId, depth) {
        if (depth > 12 || objectCount >= 5000) {
            truncated = true
            return objectMetadata(da, objectId)
        }
        if (visited[String(objectId)]) return objectMetadata(da, objectId)
        visited[String(objectId)] = true
        objectCount++
        var node = objectMetadata(da, objectId)
        var kids = childObjects(da, objectId)
        if (!kids.error) {
            node.childCount = kids.count
            node.children = []
            for (var i = 0; i < kids.children.length; i++) {
                node.children.push(kids.children[i].objectId !== undefined ? walk(kids.children[i].objectId, depth + 1) : kids.children[i])
            }
        } else {
            node.childError = kids
        }
        var params = parameters(da, objectId)
        if (!params.error) {
            node.parameterCount = params.count
            node.parameters = params.parameters
        }
        return node
    }
    var tree = walk(base.objectId, 0)
    return { root: root, baseObjectId: base.objectId, objectCount: objectCount, truncated: truncated, tree: tree }
}

function pluginCollections(pluginSlotObjectId) {
    var da = findDAForObject(pluginSlotObjectId)
    if (!da || !da.mPluginManager) return { error: 'REQUIRES_CUBASE_15_API_1_3', message: 'DirectAccess plugin manager is not available' }
    var manager = da.mPluginManager
    if (!manager.getNumberOfPluginCollections) return { error: 'REQUIRES_CUBASE_15_API_1_3', message: 'getNumberOfPluginCollections is not available' }
    var collectionCount = manager.getNumberOfPluginCollections(activeMappingRef, pluginSlotObjectId)
    var activeIndex = manager.getIndexOfActivePluginCollection ? manager.getIndexOfActivePluginCollection(activeMappingRef, pluginSlotObjectId) : -1
    var defaultIndex = manager.getIndexOfDefaultPluginCollection ? manager.getIndexOfDefaultPluginCollection(activeMappingRef, pluginSlotObjectId) : -1
    var collections = []
    for (var i = 0; i < collectionCount; i++) {
        var collection = manager.getPluginCollectionByIndex(activeMappingRef, pluginSlotObjectId, i)
        var entries = []
        var rawEntries = collection && collection.mEntries ? collection.mEntries : []
        for (var entryIndex = 0; entryIndex < rawEntries.length; entryIndex++) {
            var entry = rawEntries[entryIndex]
            entries.push({
                index: entryIndex,
                pluginUid: entry.mPluginUID !== undefined ? String(entry.mPluginUID) : undefined,
                name: entry.mPluginName !== undefined ? String(entry.mPluginName) : (entry.mName !== undefined ? String(entry.mName) : undefined),
                title: entry.mTitle !== undefined ? String(entry.mTitle) : undefined,
                vendor: entry.mVendor !== undefined ? String(entry.mVendor) : undefined,
                category: entry.mCategory !== undefined ? String(entry.mCategory) : undefined
            })
        }
        collections.push({
            index: i,
            name: collection && collection.mName !== undefined ? String(collection.mName) : undefined,
            title: collection && collection.mTitle !== undefined ? String(collection.mTitle) : undefined,
            entryCount: entries.length,
            entries: entries
        })
    }
    return {
        pluginSlotObjectId: pluginSlotObjectId,
        collectionCount: collectionCount,
        activeCollectionIndex: activeIndex,
        defaultCollectionIndex: defaultIndex,
        assignmentSupported: !!manager.trySetSlotPlugin,
        resetSupported: !!manager.resetSlotPlugin,
        dryRunSupported: true,
        collections: collections
    }
}

function setSlotPlugin(pluginSlotObjectId, pluginUid) {
    var da = findDAForObject(pluginSlotObjectId)
    if (!da || !da.mPluginManager || !da.mPluginManager.trySetSlotPlugin) return { error: 'REQUIRES_CUBASE_15_API_1_3', message: 'trySetSlotPlugin is not available' }
    var ok = da.mPluginManager.trySetSlotPlugin(activeMappingRef, pluginSlotObjectId, pluginUid, true)
    return { pluginSlotObjectId: pluginSlotObjectId, pluginUid: pluginUid, accepted: ok }
}

function resetSlotPlugin(pluginSlotObjectId) {
    var da = findDAForObject(pluginSlotObjectId)
    if (!da || !da.mPluginManager || !da.mPluginManager.resetSlotPlugin) return { error: 'REQUIRES_CUBASE_15_API_1_3', message: 'resetSlotPlugin is not available' }
    da.mPluginManager.resetSlotPlugin(activeMappingRef, pluginSlotObjectId)
    return { pluginSlotObjectId: pluginSlotObjectId, reset: true }
}

function handleDirectAccess(id, request) {
    if (!activeMappingRef) {
        directFail(id, 'DIRECT_ACCESS_INACTIVE', 'DirectAccess page is not active')
        return
    }
    try {
        if (request.type === 'DA_GET_API_VERSION') {
            directResponse(id, { hostAppVersion: getApiVersion(), midiRemoteApiVersion: inferMidiRemoteApiVersion(), versionSource: 'feature_detection' })
        } else if (request.type === 'DA_GET_CAPABILITIES') {
            directResponse(id, {
                hostAppVersion: getApiVersion(),
                midiRemoteApiVersion: inferMidiRemoteApiVersion(),
                versionSource: 'feature_detection',
                makeDirectAccess: !!(page.mHostAccess && page.mHostAccess.makeDirectAccess),
                roots: ['trackSelection', 'mixConsole', 'focusedQuickControls', 'transport'],
                extendedV13: {
                    getObjectTypeName: !!(findDAForObject(0) && findDAForObject(0).getObjectTypeName),
                    getParameterProcessValueType: !!(findDAForObject(0) && findDAForObject(0).getParameterProcessValueType),
                    isParameterAutomatable: !!(findDAForObject(0) && findDAForObject(0).isParameterAutomatable),
                    pluginManager: !!(findDAForObject(0) && findDAForObject(0).mPluginManager)
                }
            })
        } else if (request.type === 'DA_DISCOVER_OBJECT_TREE') {
            var tree = discoverTree(request.root)
            tree.error ? directFail(id, tree.error, tree.message || tree.error, tree) : directResponse(id, tree)
        } else if (request.type === 'DA_GET_OBJECT_METADATA') {
            directResponse(id, objectMetadata(findDAForObject(request.objectId), request.objectId))
        } else if (request.type === 'DA_GET_CHILD_OBJECTS') {
            var children = childObjects(findDAForObject(request.objectId), request.objectId)
            children.error ? directFail(id, children.error, children.message, children) : directResponse(id, children)
        } else if (request.type === 'DA_GET_PARAMETERS') {
            var params = parameters(findDAForObject(request.objectId), request.objectId)
            params.error ? directFail(id, params.error, params.message, params) : directResponse(id, params)
        } else if (request.type === 'DA_GET_PARAMETER') {
            directResponse(id, parameter(findDAForObject(request.objectId), request.objectId, request.parameterTag))
        } else if (request.type === 'DA_SET_PARAMETER_PROCESS_VALUE') {
            var da1 = findDAForObject(request.objectId)
            if (!da1 || !da1.setParameterProcessValue) directFail(id, 'CUBASE_API_NOT_EXPOSED', 'setParameterProcessValue is not available', request)
            else {
                da1.setParameterProcessValue(activeMappingRef, request.objectId, request.parameterTag, request.value)
                directResponse(id, { objectId: request.objectId, parameterTag: request.parameterTag, value: request.value })
            }
        } else if (request.type === 'DA_SET_PARAMETER_PLAIN_VALUE') {
            var da2 = findDAForObject(request.objectId)
            if (!da2 || !da2.convertParameterPlainToProcessValue || !da2.setParameterProcessValue) directFail(id, 'CUBASE_API_NOT_EXPOSED', 'plain-value conversion or parameter write is not available', request)
            else {
                var processValue = da2.convertParameterPlainToProcessValue(activeMappingRef, request.objectId, request.parameterTag, request.plainValue)
                da2.setParameterProcessValue(activeMappingRef, request.objectId, request.parameterTag, processValue)
                directResponse(id, { objectId: request.objectId, parameterTag: request.parameterTag, plainValue: request.plainValue, processValue: processValue })
            }
        } else if (request.type === 'DA_GET_PLUGIN_COLLECTIONS') {
            var collections = pluginCollections(request.pluginSlotObjectId)
            collections.error ? directFail(id, collections.error, collections.message, collections) : directResponse(id, collections)
        } else if (request.type === 'DA_SET_SLOT_PLUGIN') {
            var setResult = setSlotPlugin(request.pluginSlotObjectId, request.pluginUid)
            setResult.error ? directFail(id, setResult.error, setResult.message, setResult) : directResponse(id, setResult)
        } else if (request.type === 'DA_RESET_SLOT_PLUGIN') {
            var resetResult = resetSlotPlugin(request.pluginSlotObjectId)
            resetResult.error ? directFail(id, resetResult.error, resetResult.message, resetResult) : directResponse(id, resetResult)
        } else if (request.type === 'DA_SUBSCRIBE_OBJECT_CHANGES') {
            subscriptions.objects = true
            directResponse(id, { subscribed: true, eventTypes: ['direct_access_object_change', 'direct_access_object_will_be_removed'] })
        } else if (request.type === 'DA_SUBSCRIBE_PARAMETER_CHANGES') {
            subscriptions.parameters[String(request.objectId)] = true
            directResponse(id, { subscribed: true, objectId: request.objectId, eventTypes: ['direct_access_parameter_change'] })
        } else {
            directFail(id, 'UNKNOWN_DIRECT_ACCESS_REQUEST', 'Unknown DirectAccess request type', request)
        }
    } catch (e) {
        directFail(id, 'DIRECT_ACCESS_EXCEPTION', String(e), { raw: e })
    }
}

function bindButton(cc, x, y, hostValue, onProcessValue) {
    var button = deviceDriver.mSurface.makeButton(x, y, 1, 1)
    button.setTypePush()
    button.mSurfaceValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToControlChange(0, cc)
    page.makeValueBinding(button.mSurfaceValue, hostValue)
    if (onProcessValue) {
        hostValue.mOnProcessValueChange = function(activeDevice, activeMapping, value) {
            onProcessValue(value)
            sendState()
        }
    }
    return button
}

function bindContinuous(cc, x, y, hostValue, onProcessValue, onDisplayValue) {
    var control = deviceDriver.mSurface.makeKnob(x, y, 1, 1)
    control.mSurfaceValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToControlChange(0, cc)
    page.makeValueBinding(control.mSurfaceValue, hostValue)
    if (onProcessValue) {
        hostValue.mOnProcessValueChange = function(activeDevice, activeMapping, value) {
            onProcessValue(value)
            sendState()
        }
    }
    if (onDisplayValue) {
        hostValue.mOnDisplayValueChange = function(activeDevice, activeMapping, value, units) {
            onDisplayValue(value, units)
            sendState()
        }
    }
    return control
}

function setupHeadlessHostBindings() {
    var transport = page.mHostAccess.mTransport.mValue
    var selected = page.mHostAccess.mTrackSelection.mMixerChannel
    bindButton(20, 0, 0, transport.mStart, function(value) { if (value > 0) bridgeState.transport.state = 'playing' })
    bindButton(21, 1, 0, transport.mStop, function(value) { if (value > 0) bridgeState.transport.state = 'stopped' })
    bindButton(22, 2, 0, transport.mRecord, function(value) { if (value > 0) bridgeState.transport.state = 'recording' })
    bindButton(23, 3, 0, transport.mRewind)
    bindButton(24, 4, 0, transport.mForward)
    bindButton(25, 5, 0, transport.mCycleActive, function(value) { bridgeState.transport.cycleEnabled = value > 0 })
    bindButton(26, 6, 0, transport.mMetronomeActive, function(value) { bridgeState.transport.metronomeEnabled = value > 0 })

    selected.mOnTitleChange = function(activeDevice, activeMapping, title) {
        bridgeState.selectedTrack.name = title
        if (selected.getRuntimeID) bridgeState.selectedTrack.runtimeId = selected.getRuntimeID(activeMapping)
        if (selected.getUniqueIDString) bridgeState.selectedTrack.uniqueId = selected.getUniqueIDString(activeMapping)
        sendState()
    }
    bindContinuous(30, 0, 2, selected.mValue.mVolume,
        function(value) { bridgeState.selectedTrack.volumeProcessValue = value },
        function(value, units) { bridgeState.selectedTrack.volumeDisplayValue = value; bridgeState.selectedTrack.volumeUnits = units })
    bindContinuous(31, 1, 2, selected.mValue.mPan,
        function(value) { bridgeState.selectedTrack.panProcessValue = value },
        function(value, units) { bridgeState.selectedTrack.panDisplayValue = value; bridgeState.selectedTrack.panUnits = units })
    bindButton(32, 2, 2, selected.mValue.mMute, function(value) { bridgeState.selectedTrack.mute = value > 0 })
    bindButton(33, 3, 2, selected.mValue.mSolo, function(value) { bridgeState.selectedTrack.solo = value > 0 })
    bindButton(34, 4, 2, selected.mValue.mRecordEnable, function(value) { bridgeState.selectedTrack.recordEnabled = value > 0 })
    bindButton(35, 5, 2, selected.mValue.mMonitorEnable, function(value) { bridgeState.selectedTrack.monitorEnabled = value > 0 })
    if (selected.mPreFilter && selected.mPreFilter.mGain) {
        bindContinuous(36, 6, 2, selected.mPreFilter.mGain,
            function(value) { bridgeState.selectedTrack.inputGainProcessValue = value },
            function(value, units) { bridgeState.selectedTrack.inputGainDisplayValue = value; bridgeState.selectedTrack.inputGainUnits = units })
    }
    if (selected.mPreFilter && selected.mPreFilter.mPhaseSwitch) {
        bindButton(37, 7, 2, selected.mPreFilter.mPhaseSwitch, function(value) { bridgeState.selectedTrack.phaseInvert = value > 0 })
    }

    for (var selectedIndex = 0; selectedIndex < 8; selectedIndex++) {
        (function(index) {
            var value = selected.mQuickControls.getByIndex(index)
            bindContinuous(40 + index, index, 5, value,
                function(processValue) {
                    bridgeState.selectedQuickControls[index] = bridgeState.selectedQuickControls[index] || { index: index }
                    bridgeState.selectedQuickControls[index].processValue = processValue
                },
                function(displayValue, units) {
                    bridgeState.selectedQuickControls[index] = bridgeState.selectedQuickControls[index] || { index: index }
                    bridgeState.selectedQuickControls[index].displayValue = displayValue
                    bridgeState.selectedQuickControls[index].units = units
                })
            value.mOnTitleChange = function(activeDevice, activeMapping, objectTitle, valueTitle) {
                bridgeState.selectedQuickControls[index] = bridgeState.selectedQuickControls[index] || { index: index }
                bridgeState.selectedQuickControls[index].objectTitle = objectTitle
                bridgeState.selectedQuickControls[index].valueTitle = valueTitle
                sendState()
            }
        })(selectedIndex)
    }
    for (var focusedIndex = 0; focusedIndex < 8; focusedIndex++) {
        (function(index) {
            var value = page.mHostAccess.mFocusedQuickControls.getByIndex(index)
            bindContinuous(50 + index, index, 7, value,
                function(processValue) {
                    bridgeState.focusedQuickControls[index] = bridgeState.focusedQuickControls[index] || { index: index }
                    bridgeState.focusedQuickControls[index].processValue = processValue
                },
                function(displayValue, units) {
                    bridgeState.focusedQuickControls[index] = bridgeState.focusedQuickControls[index] || { index: index }
                    bridgeState.focusedQuickControls[index].displayValue = displayValue
                    bridgeState.focusedQuickControls[index].units = units
                })
            value.mOnTitleChange = function(activeDevice, activeMapping, objectTitle, valueTitle) {
                bridgeState.focusedQuickControls[index] = bridgeState.focusedQuickControls[index] || { index: index }
                bridgeState.focusedQuickControls[index].objectTitle = objectTitle
                bridgeState.focusedQuickControls[index].valueTitle = valueTitle
                sendState()
            }
        })(focusedIndex)
    }
}

function makeCommandButton(command) {
    var index = command.cc - 80
    var button = deviceDriver.mSurface.makeButton(index % 12, 12 + Math.floor(index / 12), 1, 1)
    button.setTypePush()
    button.mSurfaceValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToControlChange(0, command.cc)
    var binding
    try {
        binding = page.makeCommandBinding(button.mSurfaceValue, command.category, command.name)
    } catch (e) {
        commandRegistry[command.key] = { command: command, error: String(e) }
        return
    }
    commandRegistry[command.key] = { command: command, binding: binding }
    commandButtons[command.key] = button
}

setupHeadlessHostBindings()
for (var c = 0; c < commandCandidates.length; c++) makeCommandButton(commandCandidates[c])

function inspectCommands() {
    var result = []
    for (var key in commandRegistry) {
        if (!commandRegistry.hasOwnProperty(key)) continue
        var entry = commandRegistry[key]
        var item = {
            key: key,
            category: entry.command.category,
            name: entry.command.name,
            cc: entry.command.cc,
            dialogRisk: !!entry.command.dialogRisk,
            selectionDependent: !!entry.command.selectionDependent,
            destructive: !!entry.command.destructive,
            requiresExistingExportSettings: !!entry.command.requiresExistingExportSettings,
            bindingCreated: !!entry.binding,
            error: entry.error
        }
        if (entry.binding && entry.binding.canPerform) {
            item.canPerformSupported = true
            try {
                item.canPerform = entry.binding.canPerform(activeMappingRef)
            } catch (e) {
                item.canPerformError = String(e)
            }
        } else {
            item.canPerform = undefined
            item.canPerformSupported = false
        }
        result.push(item)
    }
    return result
}

function handleCommandBinding(id, payload) {
    try {
        if (payload.type === 'COMMAND_GET_REGISTRY') {
            success(id, 'command_binding', { ok: true, requestId: id, data: inspectCommands() })
            return
        }
        if (payload.type === 'COMMAND_CAN_PERFORM') {
            var entry = commandRegistry[payload.key]
            if (!entry || !entry.binding) {
                success(id, 'command_binding', { ok: false, requestId: id, error: { code: 'COMMAND_NOT_REGISTERED', message: 'Command is not registered', raw: payload } })
                return
            }
            var can = entry.binding.canPerform ? entry.binding.canPerform(activeMappingRef) : undefined
            success(id, 'command_binding', { ok: true, requestId: id, data: { key: payload.key, canPerform: can, canPerformSupported: !!entry.binding.canPerform, command: entry.command } })
            return
        }
        success(id, 'command_binding', { ok: false, requestId: id, error: { code: 'UNKNOWN_COMMAND_BINDING_REQUEST', message: 'Unknown command binding request', raw: payload } })
    } catch (e) {
        success(id, 'command_binding', { ok: false, requestId: id, error: { code: 'COMMAND_BINDING_EXCEPTION', message: String(e), raw: payload } })
    }
}

midiInput.mOnSysex = function(activeDevice, message) {
    activeDeviceRef = activeDevice
    var decoded
    try {
        decoded = decodeRequest(message)
        if (!decoded) return
        if (decoded.command === 'ping' || decoded.command === 'get_state') {
            bridgeState.appVersion = getApiVersion()
            bridgeState.midiRemoteApiVersion = inferMidiRemoteApiVersion()
            success(decoded.id, decoded.command, {
                appVersion: bridgeState.appVersion,
                midiRemoteApiVersion: bridgeState.midiRemoteApiVersion,
                state: bridgeState,
                directAccess: {
                    active: !!activeMappingRef,
                    makeDirectAccess: !!(page.mHostAccess && page.mHostAccess.makeDirectAccess)
                },
                commandBindings: inspectCommands(),
                protocol: {
                    framing: ['AIMCP1', 'AIMCP1C'],
                    maximumFrameBytes: MAX_SYSEX_FRAME_BYTES,
                    chunking: true,
                    checksum: 'fnv1a32'
                }
            })
            sendState()
            return
        }
        if (decoded.command === 'direct_access') {
            handleDirectAccess(decoded.id, decoded.payload.request || decoded.payload)
            return
        }
        if (decoded.command === 'command_binding') {
            handleCommandBinding(decoded.id, decoded.payload)
            return
        }
        if (decoded.command === 'plugin_bridge') {
            success(decoded.id, 'plugin_bridge', {
                id: decoded.payload && decoded.payload.id ? decoded.payload.id : decoded.id,
                correlationId: decoded.payload && decoded.payload.correlationId,
                protocol: 'cubase-mcp-plugin-bridge',
                version: 1,
                ok: false,
                error: {
                    code: 'NEEDS_CUBASE_SIDE_BRIDGE',
                    message: 'The MIDI Remote script cannot perform binary companion-bridge operations. Install the named-pipe Cubase-side bridge.',
                    details: { command: decoded.payload && decoded.payload.command, pipe: '\\\\.\\pipe\\cubase-mcp-plugin-bridge' },
                    recoverable: true
                }
            })
            return
        }
        fail(decoded.id, decoded.command, 'UNKNOWN_REQUEST', 'Unknown bridge request', decoded)
    } catch (e) {
        fail(decoded && decoded.id, decoded && decoded.command, 'BRIDGE_EXCEPTION', String(e), { raw: decoded })
    }
}

page.mOnActivate = function(activeDevice, activeMapping) {
    activeDeviceRef = activeDevice
    activeMappingRef = activeMapping
    directAccess = {}
    directAccessActivated = {}
    objectOwners = {}
    bridgeState.appVersion = getApiVersion()
    var roots = ['trackSelection', 'mixConsole', 'focusedQuickControls', 'transport']
    for (var i = 0; i < roots.length; i++) ensureDirectAccess(roots[i])
    bridgeState.midiRemoteApiVersion = inferMidiRemoteApiVersion()
    sendProtocol('hello', undefined, 'hello', true, {
        appVersion: bridgeState.appVersion,
        midiRemoteApiVersion: bridgeState.midiRemoteApiVersion,
        state: bridgeState,
        directAccess: {
            active: true,
            makeDirectAccess: !!(page.mHostAccess && page.mHostAccess.makeDirectAccess)
        },
        commandBindings: inspectCommands(),
        protocol: { framing: ['AIMCP1', 'AIMCP1C'], maximumFrameBytes: MAX_SYSEX_FRAME_BYTES, chunking: true, checksum: 'fnv1a32' }
    }, undefined)
    sendState()
}

page.mOnDeactivate = function(activeDevice, activeMapping) {
    activeDeviceRef = activeDevice
    for (var root in directAccess) {
        if (directAccess.hasOwnProperty(root) && directAccess[root].deactivate && directAccessActivated[root]) {
            try { directAccess[root].deactivate(activeMapping) } catch (e) {}
        }
    }
    success(undefined, 'deactivate', { directAccess: { active: false } })
    activeMappingRef = null
    directAccess = {}
    directAccessActivated = {}
    objectOwners = {}
}

deviceDriver.mOnDeactivate = function(activeDevice) {
    activeDeviceRef = activeDevice
    activeMappingRef = null
    directAccess = {}
    directAccessActivated = {}
    objectOwners = {}
}

deviceDriver.mOnIdle = function(activeDevice) {
    activeDeviceRef = activeDevice
    var now = new Date().getTime()
    for (var transferId in incomingChunks) {
        if (incomingChunks.hasOwnProperty(transferId) && now - incomingChunks[transferId].createdAt > 5000) delete incomingChunks[transferId]
    }
    var hasParameterSubscriptions = false
    for (var parameterObjectId in subscriptions.parameters) {
        if (subscriptions.parameters.hasOwnProperty(parameterObjectId)) { hasParameterSubscriptions = true; break }
    }
    if (activeMappingRef && (subscriptions.objects || hasParameterSubscriptions) && now - lastDirectAccessUpdateAt >= 100) {
        lastDirectAccessUpdateAt = now
        for (var root in directAccess) {
            if (directAccess.hasOwnProperty(root) && directAccess[root].update) {
                try { directAccess[root].update(activeMappingRef) } catch (e) {}
            }
        }
    }
}
