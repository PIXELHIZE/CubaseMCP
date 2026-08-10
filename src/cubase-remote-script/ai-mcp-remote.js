// AI MCP Remote for Cubase/Nuendo MIDI Remote API v1.
// Install this file inside Cubase's MIDI Remote Driver Scripts folder.
// It does not use OS, window, keyboard, mouse, screenshot, or OCR automation.

var midiremote_api = require('midiremote_api_v1')

var deviceDriver = midiremote_api.makeDeviceDriver('OpenAI', 'AI MCP Remote', 'OpenAI')
var midiInput = deviceDriver.mPorts.makeMidiInput('AI MCP Bridge To Cubase')
var midiOutput = deviceDriver.mPorts.makeMidiOutput('AI MCP Bridge From Cubase')

deviceDriver.makeDetectionUnit().detectPortPair(midiInput, midiOutput)
    .expectInputNameEquals('AI MCP Bridge To Cubase')
    .expectOutputNameEquals('AI MCP Bridge From Cubase')

var MAGIC = 'AIMCP1:'
var MANUFACTURER = 0x7d
var state = {
    appName: midiremote_api.mDefaults.getAppName(),
    appVersion: midiremote_api.mDefaults.mAppVersion.getVersionString(),
    projectOpen: true,
    transport: {
        state: 'stopped',
        cycleEnabled: false,
        metronomeEnabled: false
    },
    selectedTrack: {
        name: 'Selected Track'
    },
    selectedQuickControls: [],
    focusedQuickControls: []
}

function getHostProfile() {
    var majorMatch = String(state.appVersion).match(/\d+/)
    var major = majorMatch ? Number(majorMatch[0]) : 0
    if (major === 14) return 'safe14'
    if (major === 15) return 'safe15'
    return 'unsupported-' + String(major || 'unknown')
}

function asciiBytes(text) {
    var bytes = []
    for (var i = 0; i < text.length; i++) {
        var code = text.charCodeAt(i)
        bytes.push(code < 128 ? code : 63)
    }
    return bytes
}

function sendProtocol(activeDevice, type, id, command, ok, payload, error) {
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
    var json = JSON.stringify(message)
    var bytes = [0xf0, MANUFACTURER].concat(asciiBytes(MAGIC + json)).concat([0xf7])
    midiOutput.sendMidi(activeDevice, bytes)
}

function sendState(activeDevice) {
    sendProtocol(activeDevice, 'state', undefined, 'state', true, state, undefined)
}

function decodeRequest(message) {
    if (!message || message.length < 4 || message[0] !== 0xf0 || message[1] !== MANUFACTURER || message[message.length - 1] !== 0xf7) {
        return undefined
    }
    var text = ''
    for (var i = 2; i < message.length - 1; i++) text += String.fromCharCode(message[i])
    if (text.indexOf(MAGIC) !== 0) return undefined
    return JSON.parse(text.substring(MAGIC.length))
}

midiInput.mOnSysex = function(activeDevice, message) {
    var request
    try {
        request = decodeRequest(message)
        if (!request) return
        if (request.command === 'ping' || request.command === 'get_state') {
            sendProtocol(activeDevice, 'response', request.id, request.command, true, {
                state: state,
                appName: state.appName,
                appVersion: state.appVersion,
                mcpProtocol: { version: 2, transportVersion: 1, releaseProfile: getHostProfile(), scriptBuild: '2.0.0-safe14' }
            }, undefined)
            sendState(activeDevice)
            return
        }
        sendProtocol(activeDevice, 'error', request.id, request.command, false, undefined, {
            code: 'CAPABILITY_UNSUPPORTED',
            message: 'AI MCP Remote script supports ping/get_state over SysEx; host control is performed by mapped MIDI CC.'
        })
    } catch (e) {
        sendProtocol(activeDevice, 'error', request && request.id, request && request.command, false, undefined, {
            code: 'BRIDGE_SCRIPT_ERROR',
            message: String(e)
        })
    }
}

function bindButton(page, cc, x, y, hostValue, update) {
    var button = deviceDriver.mSurface.makeButton(x, y, 1, 1)
    button.setTypePush()
    button.mSurfaceValue.mMidiBinding
        .setInputPort(midiInput)
        .setOutputPort(midiOutput)
        .bindToControlChange(0, cc)
    page.makeValueBinding(button.mSurfaceValue, hostValue)
    if (update) {
        hostValue.mOnProcessValueChange = function(activeDevice, activeMapping, value) {
            update(value)
            sendState(activeDevice)
        }
    }
    return button
}

function bindFader(page, cc, x, y, hostValue, update) {
    var fader = deviceDriver.mSurface.makeFader(x, y, 1, 4)
    fader.setTypeVertical()
    fader.mSurfaceValue.mMidiBinding
        .setInputPort(midiInput)
        .setOutputPort(midiOutput)
        .bindToControlChange(0, cc)
    page.makeValueBinding(fader.mSurfaceValue, hostValue)
    if (update) {
        hostValue.mOnDisplayValueChange = function(activeDevice, activeMapping, value, units) {
            update(value, units)
            sendState(activeDevice)
        }
    }
    return fader
}

function bindKnob(page, cc, x, y, hostValue, update) {
    var knob = deviceDriver.mSurface.makeKnob(x, y, 1, 1)
    knob.mSurfaceValue.mMidiBinding
        .setInputPort(midiInput)
        .setOutputPort(midiOutput)
        .bindToControlChange(0, cc)
    page.makeValueBinding(knob.mSurfaceValue, hostValue)
    if (update) {
        hostValue.mOnDisplayValueChange = function(activeDevice, activeMapping, value, units) {
            update(value, units)
            sendState(activeDevice)
        }
    }
    return knob
}

function safeBind(activeDevice, label, fn) {
    try {
        fn()
    } catch (e) {
        sendProtocol(activeDevice, 'event', undefined, 'binding_warning', true, {
            label: label,
            warning: String(e)
        }, undefined)
    }
}

var page = deviceDriver.mMapping.makePage('AI MCP Headless Controls')

page.mOnActivate = function(activeDevice, activeMapping) {
    var transport = page.mHostAccess.mTransport.mValue
    var selected = page.mHostAccess.mTrackSelection.mMixerChannel

    safeBind(activeDevice, 'transport', function() {
        bindButton(page, 20, 0, 0, transport.mStart, function(value) { state.transport.state = value > 0 ? 'playing' : state.transport.state })
        bindButton(page, 21, 1, 0, transport.mStop, function(value) { if (value > 0) state.transport.state = 'stopped' })
        bindButton(page, 22, 2, 0, transport.mRecord, function(value) { state.transport.state = value > 0 ? 'recording' : state.transport.state })
        bindButton(page, 23, 3, 0, transport.mRewind)
        bindButton(page, 24, 4, 0, transport.mForward)
        bindButton(page, 25, 5, 0, transport.mCycleActive, function(value) { state.transport.cycleEnabled = value > 0 })
        bindButton(page, 26, 6, 0, transport.mMetronomeActive, function(value) { state.transport.metronomeEnabled = value > 0 })
    })

    safeBind(activeDevice, 'selected-channel', function() {
        selected.mOnTitleChange = function(activeDevice2, activeMapping2, title) {
            state.selectedTrack.name = title
            if (typeof selected.getRuntimeID === 'function') state.selectedTrack.runtimeId = selected.getRuntimeID(activeMapping2)
            sendState(activeDevice2)
        }
        bindFader(page, 30, 0, 2, selected.mValue.mVolume, function(value, units) { state.selectedTrack.volumeDisplay = value + (units || '') })
        bindKnob(page, 31, 1, 2, selected.mValue.mPan, function(value, units) { state.selectedTrack.panDisplay = value + (units || '') })
        bindButton(page, 32, 2, 2, selected.mValue.mMute, function(value) { state.selectedTrack.mute = value > 0 })
        bindButton(page, 33, 3, 2, selected.mValue.mSolo, function(value) { state.selectedTrack.solo = value > 0 })
        bindButton(page, 34, 4, 2, selected.mValue.mRecordEnable, function(value) { state.selectedTrack.recordEnabled = value > 0 })
        bindButton(page, 35, 5, 2, selected.mValue.mMonitorEnable, function(value) { state.selectedTrack.monitorEnabled = value > 0 })
    })

    safeBind(activeDevice, 'quick-controls', function() {
        for (var i = 0; i < 8; i++) {
            (function(index) {
                var qc = selected.mQuickControls.getByIndex(index)
                bindKnob(page, 40 + index, index, 7, qc, function(value, units) {
                    state.selectedQuickControls[index] = { index: index, displayValue: value + (units || '') }
                })
                qc.mOnTitleChange = function(activeDevice2, activeMapping2, objectTitle, valueTitle) {
                    state.selectedQuickControls[index] = {
                        index: index,
                        objectTitle: objectTitle,
                        valueTitle: valueTitle,
                        displayValue: state.selectedQuickControls[index] && state.selectedQuickControls[index].displayValue
                    }
                    sendState(activeDevice2)
                }
            })(i)
        }
    })

    safeBind(activeDevice, 'focused-quick-controls', function() {
        for (var j = 0; j < 8; j++) {
            (function(index) {
                var qc = page.mHostAccess.mFocusedQuickControls.getByIndex(index)
                bindKnob(page, 50 + index, index, 9, qc, function(value, units) {
                    state.focusedQuickControls[index] = { index: index, displayValue: value + (units || '') }
                })
                qc.mOnTitleChange = function(activeDevice2, activeMapping2, objectTitle, valueTitle) {
                    state.focusedQuickControls[index] = {
                        index: index,
                        objectTitle: objectTitle,
                        valueTitle: valueTitle,
                        displayValue: state.focusedQuickControls[index] && state.focusedQuickControls[index].displayValue
                    }
                    sendState(activeDevice2)
                }
            })(j)
        }
    })

    sendProtocol(activeDevice, 'hello', undefined, 'hello', true, state, undefined)
    sendState(activeDevice)
}

deviceDriver.mOnIdle = function(activeDevice) {
    if (!deviceDriver._aiMcpIdleCounter) deviceDriver._aiMcpIdleCounter = 0
    deviceDriver._aiMcpIdleCounter++
    if (deviceDriver._aiMcpIdleCounter > 200) {
        deviceDriver._aiMcpIdleCounter = 0
        sendState(activeDevice)
    }
}
