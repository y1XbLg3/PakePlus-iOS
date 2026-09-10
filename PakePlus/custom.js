window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});(() => {
    'use strict'

    const CYCREVO = {
        version: '1.0.0',

        state: {
            orientation: null,
            motion: null,
            viewport: null,
        },

        capabilities() {
            let webgl = false
            let webgl2 = false

            try {
                const canvas = document.createElement('canvas')

                webgl2 = !!canvas.getContext('webgl2')
                webgl =
                    webgl2 ||
                    !!canvas.getContext('webgl') ||
                    !!canvas.getContext('experimental-webgl')
            } catch (_) {}

            return {
                tauri: !!window.__TAURI__,

                tauriInvoke:
                    typeof window.__TAURI__?.core?.invoke === 'function',

                camera:
                    typeof navigator.mediaDevices?.getUserMedia ===
                    'function',

                bluetooth:
                    typeof navigator.bluetooth?.requestDevice ===
                    'function',

                serial:
                    typeof navigator.serial?.requestPort ===
                    'function',

                deviceOrientation:
                    typeof window.DeviceOrientationEvent !==
                    'undefined',

                deviceMotion:
                    typeof window.DeviceMotionEvent !==
                    'undefined',

                webgpu: !!navigator.gpu,
                webgl,
                webgl2,

                visualViewport: !!window.visualViewport,

                fullscreen:
                    typeof document.documentElement
                        .requestFullscreen === 'function',
            }
        },

        async requestMotionPermission() {
            const result = {
                orientation: 'unsupported',
                motion: 'unsupported',
                granted: false,
            }

            try {
                if (
                    typeof window.DeviceOrientationEvent !==
                    'undefined'
                ) {
                    if (
                        typeof window.DeviceOrientationEvent
                            .requestPermission === 'function'
                    ) {
                        result.orientation =
                            await window.DeviceOrientationEvent
                                .requestPermission()
                    } else {
                        result.orientation = 'granted'
                    }
                }

                if (
                    typeof window.DeviceMotionEvent !== 'undefined'
                ) {
                    if (
                        typeof window.DeviceMotionEvent
                            .requestPermission === 'function'
                    ) {
                        result.motion =
                            await window.DeviceMotionEvent
                                .requestPermission()
                    } else {
                        result.motion = 'granted'
                    }
                }

                result.granted =
                    result.orientation === 'granted' ||
                    result.motion === 'granted'

                return result
            } catch (error) {
                console.warn(
                    '[CYCREVO] Motion permission failed:',
                    error
                )

                return {
                    ...result,
                    granted: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : String(error),
                }
            }
        },

        getOrientation() {
            return this.state.orientation
        },

        getMotion() {
            return this.state.motion
        },

        getViewport() {
            return this.state.viewport
        },

        async tauriInvoke(command, args = {}) {
            const invoke =
                window.__TAURI__?.core?.invoke

            if (typeof invoke !== 'function') {
                throw new Error(
                    '当前环境没有可用的 PakePlus/Tauri API'
                )
            }

            return invoke(command, args)
        },
    }

    /*
     * IMU
     */
    const handleOrientation = (event) => {
        CYCREVO.state.orientation = {
            alpha:
                typeof event.alpha === 'number'
                    ? event.alpha
                    : null,

            beta:
                typeof event.beta === 'number'
                    ? event.beta
                    : null,

            gamma:
                typeof event.gamma === 'number'
                    ? event.gamma
                    : null,

            absolute: !!event.absolute,
            timestamp: Date.now(),
        }
    }

    const handleMotion = (event) => {
        CYCREVO.state.motion = {
            acceleration:
                event.acceleration || null,

            accelerationIncludingGravity:
                event.accelerationIncludingGravity || null,

            rotationRate:
                event.rotationRate || null,

            interval:
                typeof event.interval === 'number'
                    ? event.interval
                    : null,

            timestamp: Date.now(),
        }
    }

    window.addEventListener(
        'deviceorientation',
        handleOrientation,
        { passive: true }
    )

    window.addEventListener(
        'devicemotion',
        handleMotion,
        { passive: true }
    )

    /*
     * 横竖屏及真实可视区域
     */
    let viewportRAF = 0

    const updateViewport = () => {
        if (viewportRAF) {
            cancelAnimationFrame(viewportRAF)
        }

        viewportRAF = requestAnimationFrame(() => {
            viewportRAF = 0

            const vv = window.visualViewport

            const width =
                vv?.width ||
                window.innerWidth ||
                document.documentElement.clientWidth

            const height =
                vv?.height ||
                window.innerHeight ||
                document.documentElement.clientHeight

            const orientation =
                width >= height
                    ? 'landscape'
                    : 'portrait'

            CYCREVO.state.viewport = {
                width,
                height,
                scale: vv?.scale || 1,
                offsetTop: vv?.offsetTop || 0,
                offsetLeft: vv?.offsetLeft || 0,
                orientation,
                timestamp: Date.now(),
            }

            const root =
                document.documentElement

            root.style.setProperty(
                '--cycrevo-viewport-width',
                `${width}px`
            )

            root.style.setProperty(
                '--cycrevo-viewport-height',
                `${height}px`
            )

            root.style.setProperty(
                '--cycrevo-vh',
                `${height * 0.01}px`
            )

            root.dataset.cycrevoOrientation =
                orientation

            window.dispatchEvent(
                new CustomEvent(
                    'cycrevo:viewportchange',
                    {
                        detail:
                            CYCREVO.state.viewport,
                    }
                )
            )
        })
    }

    window.addEventListener(
        'resize',
        updateViewport,
        { passive: true }
    )

    window.addEventListener(
        'orientationchange',
        updateViewport,
        { passive: true }
    )

    if (window.visualViewport) {
        window.visualViewport.addEventListener(
            'resize',
            updateViewport,
            { passive: true }
        )
    }

    /*
     * PakePlus 官方推荐的 _blank 单窗口处理，
     * 加入协议和下载保护，避免破坏文件下载等功能。
     */
    const hookClick = (event) => {
        if (
            event.defaultPrevented ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return
        }

        const target =
            event.target instanceof Element
                ? event.target
                : event.target?.parentElement

        const anchor =
            target?.closest?.('a[href]')

        if (
            !anchor ||
            anchor.hasAttribute('download')
        ) {
            return
        }

        const baseTargetBlank =
            document.querySelector(
                'head base[target="_blank"]'
            )

        if (
            anchor.target !== '_blank' &&
            !baseTargetBlank
        ) {
            return
        }

        let url

        try {
            url = new URL(
                anchor.href,
                location.href
            )
        } catch (_) {
            return
        }

        if (
            url.protocol !== 'http:' &&
            url.protocol !== 'https:'
        ) {
            return
        }

        event.preventDefault()
        location.assign(url.href)
    }

    document.addEventListener(
        'click',
        hookClick,
        { capture: true }
    )

    /*
     * window.open 单窗口处理。
     *
     * 只接管 http/https，
     * 不破坏 blob/mailto/tel 等协议。
     */
    const nativeWindowOpen =
        typeof window.open === 'function'
            ? window.open.bind(window)
            : null

    window.open = function (
        url,
        target,
        features
    ) {
        if (!url) {
            return nativeWindowOpen
                ? nativeWindowOpen(
                      url,
                      target,
                      features
                  )
                : null
        }

        try {
            const parsed =
                new URL(
                    String(url),
                    location.href
                )

            if (
                parsed.protocol === 'http:' ||
                parsed.protocol === 'https:'
            ) {
                location.assign(parsed.href)
                return null
            }
        } catch (_) {}

        return nativeWindowOpen
            ? nativeWindowOpen(
                  url,
                  target,
                  features
              )
            : null
    }

    /*
     * 初始化
     */
    window.CYCREVO_APP = CYCREVO

    updateViewport()

    console.log(
        '[CYCREVO] Runtime capabilities:',
        CYCREVO.capabilities()
    )
})()