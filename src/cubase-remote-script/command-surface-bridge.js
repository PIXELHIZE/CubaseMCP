// Standalone command-binding-only bridge for Cubase MIDI Remote.
// Install this instead of direct-access-bridge.js when DirectAccess is unavailable.

var midiremote_api = require('midiremote_api_v1')
var driver = midiremote_api.makeDeviceDriver('OpenAI', 'AI MCP Command Surface Bridge', 'OpenAI')
var midiInput = driver.mPorts.makeMidiInput('AI MCP Bridge To Cubase')
var midiOutput = driver.mPorts.makeMidiOutput('AI MCP Bridge From Cubase')
driver.makeDetectionUnit().detectPortPair(midiInput, midiOutput)
    .expectInputNameEquals('AI MCP Bridge To Cubase')
    .expectOutputNameEquals('AI MCP Bridge From Cubase')

var page = driver.mMapping.makePage('AI MCP Commands')
var activeDeviceRef = null
var activeMappingRef = null
var MANUFACTURER = 0x7d
var MAGIC = 'AIMCP1:'
var CHUNK_MAGIC = 'AIMCP1C:'
var MAX_SYSEX_FRAME_BYTES = 1024
var CHUNK_FRAGMENT_CHARS = 640
var MAX_LOGICAL_PAYLOAD_CHARS = 4 * 1024 * 1024
var registry = {}
var bridgeState = {
    appName: midiremote_api.mDefaults.getAppName(),
    appVersion: 'unknown',
    midiRemoteApiVersion: '1.x_feature_detected',
    projectOpen: true,
    transport: { state: 'stopped', cycleEnabled: false, metronomeEnabled: false },
    selectedTrack: { name: 'Selected Track' },
    selectedQuickControls: [],
    focusedQuickControls: []
}

function getHostProfile() {
    var version = midiremote_api.mDefaults.mAppVersion.getVersionString()
    var majorMatch = String(version).match(/\d+/)
    var major = majorMatch ? Number(majorMatch[0]) : 0
    if (major === 14) return 'safe14'
    if (major === 15) return 'safe15'
    return 'unsupported-' + String(major || 'unknown')
}

var commands = [
    { key: 'track.add.audio', category: 'AddTrack', name: 'Audio', cc: 80 },
    { key: 'track.add.midi', category: 'AddTrack', name: 'MIDI', cc: 81 },
    { key: 'track.add.instrument', category: 'AddTrack', name: 'Instrument', cc: 82, dialogRisk: true },
    { key: 'track.add.group', category: 'AddTrack', name: 'Group Channel', cc: 83 },
    { key: 'track.add.fx', category: 'AddTrack', name: 'FX Channel', cc: 84, dialogRisk: true },
    { key: 'track.add.folder', category: 'AddTrack', name: 'Folder', cc: 85 },
    { key: 'track.add.marker', category: 'AddTrack', name: 'Marker', cc: 86 },
    { key: 'track.add.tempo', category: 'AddTrack', name: 'Tempo', cc: 87 },
    { key: 'track.add.chord', category: 'AddTrack', name: 'Chord', cc: 88 },
    { key: 'track.duplicate', category: 'Project', name: 'Duplicate Tracks', cc: 89, selectionDependent: true, destructive: true },
    { key: 'track.remove_selected', category: 'Project', name: 'Remove Selected Tracks', cc: 90, destructive: true, selectionDependent: true },
    { key: 'midi.quantize', category: 'Quantize Category', name: 'Quantize', cc: 91, selectionDependent: true, destructive: true },
    { key: 'audio.bounce_selection', category: 'Audio', name: 'Bounce Selection', cc: 92, selectionDependent: true, destructive: true },
    { key: 'audio.crossfade', category: 'Audio', name: 'Crossfade', cc: 93, selectionDependent: true, destructive: true },
    { key: 'audio.fade_in', category: 'Audio', name: 'Apply Standard Fade In', cc: 94, selectionDependent: true, destructive: true },
    { key: 'audio.fade_out', category: 'Audio', name: 'Apply Standard Fade Out', cc: 95, selectionDependent: true, destructive: true },
    { key: 'audio.delete_overlaps', category: 'Audio', name: 'Delete Overlaps', cc: 96, destructive: true, selectionDependent: true },
    { key: 'audio.dissolve_part', category: 'MIDI', name: 'Dissolve Part', cc: 97, selectionDependent: true, destructive: true },
    { key: 'marker.add_position_selected', category: 'Marker', name: 'Add Position Marker on Selected Track', cc: 98, selectionDependent: true, destructive: true },
    { key: 'marker.add_cycle_selected', category: 'Marker', name: 'Add Cycle Marker on Selected Track', cc: 99, selectionDependent: true, destructive: true },
    { key: 'export.perform_current_audio_export', category: 'Audio Export', name: 'Perform Audio Export', cc: 100, currentSettingsOnly: true, destructive: true },
    { key: 'edit.undo', category: 'Edit', name: 'Undo', cc: 101 },
    { key: 'edit.redo', category: 'Edit', name: 'Redo', cc: 102 },
    { key: 'midi.legato', category: 'MIDI', name: 'Legato', cc: 103, selectionDependent: true, destructive: true },
    { key: 'midi.fixed_length', category: 'MIDI', name: 'Fixed Lengths', cc: 104, selectionDependent: true, destructive: true },
    { key: 'marker.add_position_active', category: 'Marker', name: 'Add Position Marker on Active Track', cc: 105, selectionDependent: true, destructive: true },
    { key: 'marker.add_cycle_active', category: 'Marker', name: 'Add Cycle Marker on Active Track', cc: 106, selectionDependent: true, destructive: true },
    { key: 'track.rename_selected', category: 'Edit', name: 'Rename First Selected Track', cc: 107, selectionDependent: true, dialogRisk: true },
    { key: 'render.current_settings', category: 'Render in Place', name: 'Render (with Current Settings)', cc: 108, selectionDependent: true, destructive: true, currentSettingsOnly: true }
]

function asciiBytes(text) {
    var bytes = []
    for (var i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) < 128 ? text.charCodeAt(i) : 63)
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
    midiOutput.sendMidi(activeDeviceRef, [0xf0, MANUFACTURER].concat(asciiBytes(magic + json)).concat([0xf7]))
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
    var envelopes = []
    while (fragmentSize >= 64) {
        envelopes = []
        var total = Math.ceil(json.length / fragmentSize)
        var fits = true
        for (var index = 0; index < total; index++) {
            var envelope = asciiJson({
                protocol: 'cubase-mcp-midi-chunk',
                version: 1,
                transferId: transferId,
                requestId: id,
                index: index,
                total: total,
                checksum: checksum,
                payloadLength: json.length,
                fragment: json.substring(index * fragmentSize, (index + 1) * fragmentSize)
            })
            if (CHUNK_MAGIC.length + envelope.length + 3 > MAX_SYSEX_FRAME_BYTES) fits = false
            envelopes.push(envelope)
        }
        if (fits) break
        fragmentSize -= 32
    }
    if (fragmentSize < 64) throw new Error('Unable to frame AIMCP command response')
    for (var chunkIndex = 0; chunkIndex < envelopes.length; chunkIndex++) sendFrame(CHUNK_MAGIC, envelopes[chunkIndex])
}

function sendWithType(type, id, command, payload) {
    if (!activeDeviceRef) return
    var message = { protocol: 'cubase-mcp-midi', version: 1, type: type, id: id, command: command, ok: true, payload: payload, timestamp: String(new Date().toISOString()) }
    sendJson(id, asciiJson(message))
}

function send(id, command, payload) {
    sendWithType('response', id, command, payload)
}

function sendState() {
    if (!activeDeviceRef) return
    sendWithType('state', undefined, 'state', bridgeState)
}

function decode(message) {
    if (!message || message[0] !== 0xf0 || message[1] !== MANUFACTURER || message[message.length - 1] !== 0xf7) return undefined
    var text = ''
    for (var i = 2; i < message.length - 1; i++) text += String.fromCharCode(message[i])
    if (text.indexOf(MAGIC) !== 0) return undefined
    return JSON.parse(text.substring(MAGIC.length))
}

function inspect() {
    var output = []
    for (var key in registry) {
        if (!registry.hasOwnProperty(key)) continue
        var item = registry[key]
        var result = { key: key, category: item.command.category, name: item.command.name, cc: item.command.cc, bindingCreated: !!item.binding, canPerformSupported: !!(item.binding && item.binding.canPerform), selectionDependent: !!item.command.selectionDependent, destructive: !!item.command.destructive, dialogRisk: !!item.command.dialogRisk, currentSettingsOnly: !!item.command.currentSettingsOnly, error: item.error }
        if (result.canPerformSupported && activeMappingRef) {
            try { result.canPerform = item.binding.canPerform(activeMappingRef) } catch (e) { result.canPerformError = String(e) }
        }
        output.push(result)
    }
    return output
}

function bindHostButton(cc, x, y, hostValue, onProcessValue) {
    var button = driver.mSurface.makeButton(x, y, 1, 1)
    button.setTypePush()
    button.mSurfaceValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToControlChange(0, cc)
    page.makeValueBinding(button.mSurfaceValue, hostValue)
    if (onProcessValue) {
        hostValue.mOnProcessValueChange = function(activeDevice, activeMapping, value) {
            onProcessValue(value)
            sendState()
        }
    }
}

function bindHostContinuous(cc, x, y, hostValue, onProcessValue, onDisplayValue) {
    var control = driver.mSurface.makeKnob(x, y, 1, 1)
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
}

function setupHostBindings() {
    var transport = page.mHostAccess.mTransport.mValue
    bindHostButton(20, 0, 4, transport.mStart, function(value) { if (value > 0) bridgeState.transport.state = 'playing' })
    bindHostButton(21, 1, 4, transport.mStop, function(value) { if (value > 0) bridgeState.transport.state = 'stopped' })
    bindHostButton(22, 2, 4, transport.mRecord, function(value) { if (value > 0) bridgeState.transport.state = 'recording' })
    bindHostButton(23, 3, 4, transport.mRewind)
    bindHostButton(24, 4, 4, transport.mForward)
    bindHostButton(25, 5, 4, transport.mCycleActive, function(value) { bridgeState.transport.cycleEnabled = value > 0 })
    bindHostButton(26, 6, 4, transport.mMetronomeActive, function(value) { bridgeState.transport.metronomeEnabled = value > 0 })

    // Cubase 14.0.32 becomes unstable when selected-channel and focused-Quick-Control
    // callbacks are installed alongside this command surface. Keep this stable
    // transport path active and leave those controls to the feature-detected
    // DirectAccess bridge on hosts where it is safe.
    return

    var selected = page.mHostAccess.mTrackSelection.mMixerChannel
    selected.mOnTitleChange = function(activeDevice, activeMapping, title) {
        bridgeState.selectedTrack.name = title
        if (selected.getRuntimeID) bridgeState.selectedTrack.runtimeId = selected.getRuntimeID(activeMapping)
        if (selected.getUniqueIDString) bridgeState.selectedTrack.uniqueId = selected.getUniqueIDString(activeMapping)
        sendState()
    }
    bindHostContinuous(30, 0, 5, selected.mValue.mVolume,
        function(value) { bridgeState.selectedTrack.volumeProcessValue = value },
        function(value, units) { bridgeState.selectedTrack.volumeDisplayValue = value; bridgeState.selectedTrack.volumeUnits = units })
    bindHostContinuous(31, 1, 5, selected.mValue.mPan,
        function(value) { bridgeState.selectedTrack.panProcessValue = value },
        function(value, units) { bridgeState.selectedTrack.panDisplayValue = value; bridgeState.selectedTrack.panUnits = units })
    bindHostButton(32, 2, 5, selected.mValue.mMute, function(value) { bridgeState.selectedTrack.mute = value > 0 })
    bindHostButton(33, 3, 5, selected.mValue.mSolo, function(value) { bridgeState.selectedTrack.solo = value > 0 })
    bindHostButton(34, 4, 5, selected.mValue.mRecordEnable, function(value) { bridgeState.selectedTrack.recordEnabled = value > 0 })
    bindHostButton(35, 5, 5, selected.mValue.mMonitorEnable, function(value) { bridgeState.selectedTrack.monitorEnabled = value > 0 })

    for (var focusedIndex = 0; focusedIndex < 8; focusedIndex++) {
        (function(index) {
            var value = page.mHostAccess.mFocusedQuickControls.getByIndex(index)
            bindHostContinuous(50 + index, index, 6, value,
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

setupHostBindings()

for (var index = 0; index < commands.length; index++) {
    var command = commands[index]
    var button = driver.mSurface.makeButton(index % 12, Math.floor(index / 12), 1, 1)
    button.setTypePush()
    button.mSurfaceValue.mMidiBinding.setInputPort(midiInput).setOutputPort(midiOutput).bindToControlChange(0, command.cc)
    try {
        registry[command.key] = { command: command, binding: page.makeCommandBinding(button.mSurfaceValue, command.category, command.name) }
    } catch (error) {
        registry[command.key] = { command: command, error: String(error) }
    }
}

midiInput.mOnSysex = function(activeDevice, message) {
    activeDeviceRef = activeDevice
    var request
    try {
        request = decode(message)
    } catch (error) {
        sendWithType('error', undefined, 'protocol_error', { ok: false, error: { code: 'MALFORMED_REQUEST', message: String(error) } })
        return
    }
    if (!request) return
    if (request.command === 'ping' || request.command === 'get_state') {
        bridgeState.appVersion = midiremote_api.mDefaults.mAppVersion.getVersionString()
        send(request.id, request.command, {
            appName: bridgeState.appName,
            appVersion: bridgeState.appVersion,
            midiRemoteApiVersion: bridgeState.midiRemoteApiVersion,
            state: bridgeState,
            directAccess: { active: false, makeDirectAccess: false },
            mcpProtocol: { version: 2, transportVersion: 1, releaseProfile: getHostProfile(), scriptBuild: '2.0.0-safe14' }
        })
        return
    }
    if (request.command === 'command_binding') {
        if (request.payload && request.payload.type === 'COMMAND_CAN_PERFORM') {
            var item = registry[request.payload.key]
            if (!item || !item.binding) {
                send(request.id, 'command_binding', { ok: false, requestId: request.id, error: { code: 'COMMAND_NOT_REGISTERED', message: 'Command is not registered.' } })
            } else {
                var supported = !!item.binding.canPerform
                var canPerform = undefined
                if (supported && activeMappingRef) canPerform = item.binding.canPerform(activeMappingRef)
                send(request.id, 'command_binding', { ok: true, requestId: request.id, data: { key: request.payload.key, canPerformSupported: supported, canPerform: canPerform, command: item.command } })
            }
        } else {
            send(request.id, 'command_binding', { ok: true, requestId: request.id, data: inspect() })
        }
        return
    }
    send(request.id, request.command, { ok: false, requestId: request.id, error: { code: 'CAPABILITY_UNSUPPORTED', message: 'Command-surface-only bridge supports ping, state and command registry.' } })
}

page.mOnActivate = function(activeDevice, activeMapping) {
    activeDeviceRef = activeDevice
    activeMappingRef = activeMapping
    sendWithType('hello', undefined, 'hello', { appName: bridgeState.appName, appVersion: midiremote_api.mDefaults.mAppVersion.getVersionString(), commandBindings: inspect() })
    sendState()
}

page.mOnDeactivate = function(activeDevice) {
    activeDeviceRef = activeDevice
    activeMappingRef = null
}
