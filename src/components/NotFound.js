import React, { useEffect } from 'react';

export default function NotFound() {
    useEffect(() => {
        document.title = '404 — Página não encontrada';
        return () => { document.title = 'Transnet Operacional'; };
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            background: '#09334f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            fontFamily: "'Source Sans Pro', 'Segoe UI', sans-serif",
            padding: '0',
            overflow: 'hidden',
            position: 'relative',
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;900&display=swap');

                @keyframes armWave {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(7px); }
                    50% { transform: translateX(0); }
                    75% { transform: translateX(7px); }
                }
                @keyframes blink {
                    0%, 90%, 100% { transform: scaleY(1); }
                    95% { transform: scaleY(0.1); }
                }
                @keyframes lightPulse {
                    0%, 60%, 100% { opacity: 1; }
                    65%, 70% { opacity: 0; }
                    72%, 80% { opacity: 1; }
                    82%, 88% { opacity: 0; }
                    90% { opacity: 1; }
                }
                @keyframes chatter {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(1.5px); }
                }
                #yeti-arm-l, #yeti-flashlight-front {
                    animation: armWave 3s ease-in-out 2s infinite;
                }
                #yeti-eye-l, #yeti-eye-r {
                    animation: blink 4s ease-in-out infinite;
                    transform-origin: center center;
                }
                #yeti-light {
                    animation: lightPulse 10s ease-in-out infinite;
                }
                #yeti-chin {
                    animation: chatter 0.1s ease-in-out infinite;
                }
            `}</style>

            {/* SVG do Yeti */}
            <svg
                id="yetiSVG"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 600 470"
                style={{ width: 600, height: 470, position: 'absolute', top: 0, left: 0, overflow: 'hidden' }}
            >
                <linearGradient id="flashlightGrad" x1="126.5842" x2="90.5842" y1="176.5625" y2="213.5625" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#333"/>
                    <stop offset=".076" stopColor="#414141"/>
                    <stop offset=".2213" stopColor="#555"/>
                    <stop offset=".3651" stopColor="#626262"/>
                    <stop offset=".5043" stopColor="#666"/>
                    <stop offset=".6323" stopColor="#606060"/>
                    <stop offset=".8063" stopColor="#4e4e4e"/>
                    <stop offset="1" stopColor="#333"/>
                </linearGradient>
                <path fill="#24658F" d="M0 0h600v470H0z"/>
                <g id="pillow">
                    <path fill="#09334F" d="M241.3 124.6c-52.9 28.6-112.6 48-181.8 54.4-40.9 6.8-64.6-82.3-31.9-106.6C84 43.8 144.8 26.2 209.4 18c32.8 13 48.5 75.3 31.9 106.6z"/>
                    <path fill="none" stroke="#001726" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M52.8 91.3c10 7.4 25.4 50.7 16.1 65.8M241.3 124.6c-52.9 28.6-112.6 48-181.8 54.4-40.9 6.8-64.6-82.3-31.9-106.6C84 43.8 144.8 26.2 209.4 18c32.8 13 48.5 75.3 31.9 106.6z"/>
                    <path fill="#09334F" stroke="#001726" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M201.9 21.9c4.9-8 14.1-11.3 20.6-7.3s7.7 13.7 2.8 21.7"/>
                    <path fill="#09334F" stroke="#001726" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M242.1 103.1c1.8.3 3.6.9 5.3 1.8 8.4 4.1 12.6 13 9.3 19.8s-12.9 9-21.3 4.9c-1.9-.9-3.6-2.1-5-3.4"/>
                    <path fill="#09334F" stroke="#001726" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M70.3 172c.2 1.4.2 2.8.1 4.3-.8 9.4-8.3 16.4-16.7 15.6S39.2 183 40 173.7c.1-1.6.5-3.1 1-4.5"/>
                    <path fill="#09334F" stroke="#001726" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20.9 85.1c-4.1-5-5.1-11.6-2.1-16.9 4.1-7.2 14-9.2 22.1-4.6 3.7 2.1 6.4 5.2 7.9 8.6"/>
                </g>
                <g id="yeti">
                    <path id="bodyBG" fill="#67B1E0" d="M80.9 291.4l-17.1-72.8c-6.3-27 10.4-54 37.4-60.3l93.1-29.6c26.5-8.1 54.6 6.8 62.7 33.3l21.9 71.5"/>
                    <path className="hlFur" id="hlBody" fill="#FFF" d="M67.1 232.7c15.6-8.7 27.7-23.7 38-38.7 5.5-8 10.9-16.4 18.3-22.7 13.1-11.2 31.3-14.8 48.6-15 4.9 0 9.9.1 14.5-1.7 3.6-1.5 6.5-4.1 9.3-6.9 6.5-6.5 12-14 18-21-6.4-.6-12.9 0-19.4 2l-93.1 29.6c-27 6.3-43.7 33.4-37.4 60.3l3.2 14.1z"/>
                    <path id="bodyOutline" fill="none" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M80.9 291.4l-17.1-72.8c-6.3-27 10.4-54 37.4-60.3l93.1-29.6c26.5-8.1 54.6 6.8 62.7 33.3l21.9 71.5"/>
                    <path fill="#67B1E0" d="M197.5 132.4l-11.2-47.9c-6.3-26.7-32.7-44.1-59.5-38.2-27.4 6-44.5 33.1-38.1 60.3l13.6 56.2"/>
                    <path className="hlFur" id="hlHead" fill="#FFF" d="M100.4 132.3l7.4 29.8 89.7-28.8-11.4-48.9c-1.6-6.8-4.5-12.9-8.4-18.3-9.6-7.9-28.5-12.9-46.9-8.5-24.9 5.9-34.5 23.6-38.1 37.9-.8.8-3.8 3-5.1 5.4.2 1.9.5 3.7 1 5.6l7 28.8 4.8-3z"/>
                    <path fill="#67B1E0" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M182.1 71.6c3.8 3.6 7 7.7 9.5 12-1.8.4-3.6.9-5.3 1.6 3.2 2.9 5.7 6.3 7.6 9.9-1.1.3-2.2.7-3.3 1.1 2.5 3.5 4.3 7.4 5.4 11.5-.8-.5-2.2-.8-3.3-1"/>
                    <path fill="none" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M197.5 132.4l-11.2-47.9c-6.3-26.7-32.7-44.1-59.5-38.2-27.4 6-44.5 33.1-38.1 60.3l13.6 56.2"/>
                    <g>
                        <ellipse cx="85.8" cy="120.4" fill="#88C9F2" rx="11.5" ry="11.5" transform="rotate(-66.265 85.7992 120.4318)"/>
                        <path className="hlSkin" id="hlEar" fill="#DDF1FA" d="M80.4 122.2c-1.3-5.5 1.6-11.1 6.6-13.2-1.3-.1-2.6-.1-3.9.3-6.2 1.5-10 7.7-8.5 13.9s7.7 10 13.9 8.5c.7-.2 1.3-.4 1.9-.6-4.7-.6-8.9-4-10-8.9z"/>
                        <path fill="#88C9F2" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M84.2 116.6c-2.2.5-3.6 2.8-3 5 .5 2.2 2.8 3.6 5 3"/>
                        <ellipse cx="85.8" cy="120.4" fill="none" stroke="#265D85" strokeWidth="2.5" rx="11.5" ry="11.5" transform="rotate(-66.265 85.7992 120.4318)"/>
                        <path className="hlFur" fill="#FFF" d="M106 130.3l-12 3.6 1.2-11.4-6.3-.1 6-12h-5.4l9.6-8.4z"/>
                        <path className="hlFur" fill="#FFF" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M92.1 96.4c-5.1 5.9-8.4 11.7-10 17 4.2-1.2 8.5-2.2 12.8-3-4.2 4.8-6.7 9.5-7.6 13.8 2.7-.7 5.4-1.3 8-1.7-2.3 4.8-2.8 9.2-1.7 13.3 1.4-1 4-2.4 6.1-3.4"/>
                    </g>
                    <path className="hlSkin" id="face" fill="#DDF1FA" d="M169.1 70.4l7.3 23.4c9.4 26.8-1.8 45-20 50.7s-37.8-5.1-45.8-30.1L103.3 91"/>
                    <path id="yeti-chin" fill="none" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M152.4 147.5c3.8 1 8 1.4 12.3 1.1-.5-1.4-1-2.9-1.6-4.3 3.8.6 7.9.7 12.1.1l-3.3-4.8c3.1-.6 6.3-1.6 9.5-3.1-1.4-1.6-2.8-3.1-4.2-4.6"/>
                    <path className="hlFur" id="eyebrow" fill="#FFF" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M100.9 89.8c7.6 3.5 15.9 6.1 24.7 7.7 1.1-3.3 2.1-6.6 3-9.9 5.5 2.3 11.3 4.1 17.5 5.4.2-3.3.4-6.5.4-9.7 4.5.7 9.2 1.1 14 1.1-.5-3.4-1.1-6.7-1.7-10 4.5-1.9 9-4.2 13.3-6.9"/>
                    <g id="yeti-eye-l">
                        <circle cx="135.9" cy="105.3" r="3.5" fill="#265D85"/>
                        <circle cx="133.7" cy="103.5" r="1" fill="#FFF"/>
                    </g>
                    <g id="yeti-eye-r">
                        <circle cx="163.2" cy="96.3" r="3.5" fill="#265D85"/>
                        <circle cx="160.9" cy="94.5" r="1" fill="#FFF"/>
                    </g>
                    <path id="nose" fill="#265D85" d="M149.3 101.2l4.4-1.6c1.8-.6 3.6 1 3.1 2.9l-1.1 3.9c-.4 1.6-2.3 2.2-3.6 1.3l-3.3-2.3c-1.7-1.1-1.3-3.5.5-4.2z"/>
                    <path fill="#67B1E0" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M112.4 55.9c.9-4.3 3.8-9.2 8.8-13.7 1.4 2.3 2.8 4.7 4.1 7.1 2.3-4.8 6.9-9.8 13.8-14.1-.1 3.4-.3 6.8-.6 10.1 4.4-3 10.2-5.7 17.3-7.6-1.7 3.6-3.7 7.2-5.9 10.8"/>
                    <g id="mouth">
                        <path id="mouthBG" fill="#265D85" d="M149 115.7c-4.6 3.7-6.6 9.8-5 15.6.1.5.3 1.1.5 1.6.6 1.5 2.4 2.3 3.9 1.7l11.2-4.4 11.2-4.4c1.5-.6 2.3-2.4 1.7-3.9-.2-.5-.4-1-.7-1.5-2.8-5.2-8.4-8.3-14.1-7.9-3.7.2-5.9 1.1-8.7 3.2z"/>
                        <ellipse cx="160.8" cy="133.2" fill="#CC4A6C" rx="13" ry="8" transform="rotate(-21.685 160.775 133.1613)"/>
                        <path id="tooth1" fill="#FFF" d="M161.5 116.1l-3.7 1.5c-1 .4-2.2-.1-2.6-1.1l-1.5-3.7 7.4-3 1.5 3.7c.5 1 0 2.2-1.1 2.6z"/>
                        <path id="tooth2" fill="#FFF" d="M151.8 128.9l-1.9.7c-1 .4-1.5 1.6-1.1 2.6l1.1 2.8 5.6-2.2-1.1-2.8c-.5-1-1.6-1.5-2.6-1.1z"/>
                        <path id="tooth3" fill="#FFF" d="M158.3 126.3l-1.9.7c-1 .4-1.5 1.6-1.1 2.6l1.1 2.8 5.6-2.2-1.1-2.8c-.5-1-1.6-1.5-2.6-1.1z"/>
                        <path id="mouthOutline" fill="none" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M149 115.7c-4.6 3.7-6.6 9.8-5 15.6.1.5.3 1.1.5 1.6.6 1.5 2.4 2.3 3.9 1.7l11.2-4.4 11.2-4.4c1.5-.6 2.3-2.4 1.7-3.9-.2-.5-.4-1-.7-1.5-2.8-5.2-8.4-8.3-14.1-7.9-3.7.2-5.9 1.1-8.7 3.2z"/>
                    </g>
                    {/* Arm Right */}
                    <g id="armR">
                        <path className="hlSkin" fill="#DDF1FA" d="M158.4 116.9l-.7.3c-3.7 1.5-5.5 5.7-4.1 9.4l1.2 2.9c1.7 4.4 6.7 6.5 11.1 4.8l1.4-.5"/>
                        <path fill="#A9DDF3" d="M154.8 129.1l.7 1.8c1 2.5 5.4 3.1 5.4 3.1l-2-5.1c-.3-.7-1.1-1.1-1.8-.8l-2.3 1z"/>
                        <path fill="none" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M158.4 116.9l-.7.3c-3.7 1.5-5.5 5.7-4.1 9.4l1.2 2.9c1.7 4.4 6.7 6.5 11.1 4.8l1.4-.5"/>
                        <path className="hlSkin" fill="#DDF1FA" stroke="#265D85" strokeWidth="2.5" d="M167.7 113.2l-.7.3c-3.7 1.5-5.5 5.7-4.1 9.4l1.2 2.9c1.7 4.4 6.7 6.5 11.1 4.8l1.4-.5"/>
                        <path className="hlSkin" fill="#DDF1FA" stroke="#265D85" strokeWidth="2.5" d="M177 109.4l-.7.3c-3.7 1.5-5.5 5.7-4.1 9.4l1.2 2.9c1.7 4.4 6.7 6.5 11.1 4.8l1.4-.5"/>
                        <path fill="#88C9F2" d="M162.3 128.6l18.6 46.7 37.2-14.8-17.9-44.8"/>
                        <path className="hlSkin" fill="#DDF1FA" d="M206.5 130.7l-5.9-15.1-37.9 13 6.4 17.4c10 1.6 34.6-6.3 37.4-15.3z"/>
                        <path fill="none" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M162.3 128.6l18.6 46.7 37.2-14.8-15.3-38.3"/>
                        <path className="hlSkin" fill="#DDF1FA" d="M190.8 119l-1.5-3.7c-2-5.1-7.9-7.6-13-5.6l5.2 12.9"/>
                        <path className="hlSkin" fill="#DDF1FA" d="M203.5 123.8l-1.5-3.7c-2-5.1-7.9-7.6-13-5.6l5.2 12.9"/>
                        <path fill="#A9DDF3" d="M200.4 119.4l-.7-1.8c-1-2.5-5.4-3.1-5.4-3.1l1.9 4.8c.3.8 1.3 1.3 2.1.9l2.1-.8z"/>
                    </g>
                    {/* Arm Left with flashlight */}
                    <g id="yeti-arm-l">
                        <path fill="#88C9F2" d="M116.1 158.2l-26 65.5L55.9 208l25.3-63.6z"/>
                        <path className="hlFur" fill="#FFF" d="M98.2 159l-8.1 19.9 29.8 11.9 7.3-17.7c-7.7-5.2-22.9-11.8-29-14.1z"/>
                        <path fill="none" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M116.1 158.2l-26 65.5L55.9 208l25.3-63.6"/>
                        <path className="hlSkin" fill="#DDF1FA" d="M60.3 210.3l-2.4-1c-4-1.6-8.5.4-10.1 4.4L46 217c-1.8 4.6.5 9.7 5.1 11.5l2.4 1"/>
                        <path className="hlSkin" fill="#DDF1FA" stroke="#265D85" strokeWidth="2.5" d="M55.1 225.2l2.4 1c4 1.6 8.5-.4 10.1-4.4l1.8-4.4c1.8-4.6-.5-9.7-5.1-11.5l-2.4-1"/>
                        <path fill="none" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M60.3 210.3l-2.4-1c-4-1.6-8.5.4-10.1 4.4L46 217c-1.8 4.6.5 9.7 5.1 11.5l2.4 1"/>
                        {/* Flashlight body */}
                        <path fill="url(#flashlightGrad)" d="M64.3 198.3l17.6 6.9-10.2 25.9-17.6-6.9z"/>
                        <path fill="#888" d="M81.9 205.2l3.5 1.4-10.2 25.9-3.5-1.4z"/>
                        <path fill="#555" d="M64.3 198.3l3.5 1.4-10.2 25.9-3.5-1.4z"/>
                        <path fill="none" stroke="#444" strokeWidth="1" d="M64.3 198.3l17.6 6.9-10.2 25.9-17.6-6.9z"/>
                    </g>
                    {/* Flashlight front */}
                    <g id="yeti-flashlight-front">
                        <ellipse cx="74" cy="231.5" fill="#888" rx="8" ry="4" transform="rotate(-21 74 231.5)"/>
                        <ellipse cx="74" cy="231.5" fill="#aaa" rx="5" ry="2.5" transform="rotate(-21 74 231.5)"/>
                    </g>
                    {/* Light beam */}
                    <g id="yeti-light">
                        <path fill="#FFF" opacity=".15" d="M66 235 Q30 280 10 350 Q60 360 110 340 Q100 280 80 240z"/>
                        <path fill="#FFF" opacity=".08" d="M68 237 Q20 300 0 400 Q70 415 130 390 Q110 310 82 242z"/>
                    </g>
                    {/* Body legs */}
                    <path fill="#67B1E0" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M80.9 291.4c-5.2 22-11 50-14 74h40c3-22 8-48 15-68z"/>
                    <path fill="#67B1E0" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M278.9 233.5c5 19 10 44 12 67h-40c-2-21-6-44-12-63z"/>
                    <path fill="#88C9F2" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M67 365h40l5 15H62z"/>
                    <path fill="#88C9F2" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M250.9 300.5h40l5 15h-50z"/>
                </g>
                {/* 404 letters */}
                <g id="lightSVG" style={{ overflow: 'visible' }}>
                    <path className="lettersFront" fill="#67B1E0" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M266.7 322.8l19.2-6.5 12.1 37.2-19.2 6.5 13.2 40.6-45.2 15.6-13.3-40.7-77.5 26.4-11.5-34.8 26.9-128.8 61.5-19.9 33.8 104.4z"/>
                    <path className="lettersFront" fill="#67B1E0" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M436.1 339.3c.5 3.1 1 6.4 1.3 9.8.3 3.4.5 6.9.6 10.4.1 3.6 0 7.3-.1 11.1-.2 3.8-.4 7.8-.8 11.8-.4 4.1-.9 8-1.5 11.8-.6 3.8-1.3 7.5-2 11-.8 3.5-1.6 6.9-2.6 10.2-1 3.3-2 6.4-3.1 9.5-1.1 3-2.4 5.9-3.6 8.7-1.3 2.8-2.7 5.4-4.1 7.9-1.4 2.5-3 4.9-4.6 7.1-1.6 2.2-3.3 4.3-5 6.3-1.8 2-3.6 3.8-5.5 5.5-1.9 1.7-3.8 3.3-5.8 4.7-2 1.4-4.1 2.7-6.2 3.9-2.1 1.2-4.3 2.2-6.6 3.1-2.3.9-4.6 1.7-6.9 2.3-2.3.6-4.7 1.1-7.2 1.5-2.4.3-4.9.6-7.4.6-2.5.1-5.1 0-7.7-.2-2.6-.2-5.2-.5-7.7-1s-4.9-1.1-7.3-1.8c-2.4-.7-4.6-1.6-6.8-2.6s-4.3-2.1-6.4-3.4c-2.1-1.3-4-2.6-5.9-4.1-1.9-1.5-3.7-3.1-5.4-4.9-1.7-1.8-3.4-3.6-4.9-5.6-1.6-2-3-4.1-4.4-6.4-1.4-2.3-2.7-4.6-3.9-7.1-1.2-2.5-2.3-5.1-3.2-7.8-1-2.7-1.9-5.6-2.6-8.6-.8-3-1.4-6.1-2-9.3-.6-3.2-1-6.5-1.3-10-.3-3.4-.5-7-.6-10.7-.1-3.7-.1-7.5.1-11.3.1-3.9.4-7.9.8-12s.9-8.1 1.4-12c.6-3.9 1.3-7.6 2-11.2.8-3.6 1.6-7 2.6-10.4 1-3.3 2-6.5 3.2-9.6 1.2-3.1 2.4-6 3.7-8.7 1.3-2.8 2.7-5.4 4.2-7.9s3-4.8 4.7-7c1.6-2.2 3.3-4.2 5.1-6.1 1.8-1.9 3.6-3.7 5.5-5.3 1.9-1.6 3.9-3.1 5.9-4.5 2-1.4 4.1-2.6 6.3-3.7 2.1-1.1 4.4-2.1 6.6-2.9 2.3-.8 4.6-1.5 6.9-2.1 2.4-.5 4.8-1 7.2-1.2 2.5-.3 5-.4 7.5-.4 2.6 0 5.2.1 7.8.4 2.6.3 5.1.7 7.6 1.2s4.9 1.2 7.2 1.9c2.3.8 4.6 1.6 6.8 2.7 2.2 1 4.3 2.1 6.4 3.4 2.1 1.3 4 2.6 5.9 4.1 1.9 1.5 3.7 3.1 5.4 4.8 1.7 1.7 3.3 3.6 4.9 5.6 1.5 2 3 4.1 4.3 6.3 1.4 2.2 2.6 4.6 3.8 7 1.2 2.4 2.2 5 3.2 7.7.9 2.7 1.8 5.5 2.5 8.4.5 3 1.1 6 1.7 9.1z"/>
                    <path className="lettersFront" fill="#67B1E0" stroke="#265D85" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M543.3 453.7l20.1 2.9-6 38.6-20-2.8-6.5 42.1-47.4-6.5 6.5-42.3-81.1-11.4 5.4-36.2 82.2-102.8 63.8 9.9-17 108.5z"/>
                </g>
            </svg>

            {/* Text content */}
            <div style={{
                paddingTop: '5rem',
                paddingBottom: 0,
                paddingLeft: '25rem',
                paddingRight: '3rem',
                position: 'relative',
                zIndex: 10,
                color: '#FFF',
            }}>
                <h3 style={{ margin: '0 0 .8rem', fontSize: '2.625rem', fontWeight: 900, lineHeight: '120%' }}>
                    Oi?? Tem alguém aí?!?
                </h3>
                <p style={{ fontSize: '1.25rem', fontWeight: 'normal', lineHeight: '150%', color: '#d1e2ed', marginBottom: '1.5rem' }}>
                    Sabemos que é assustador, mas a página que você está tentando acessar não foi encontrada.{' '}
                    Talvez tenha sido apenas um sonho com um <span style={{ textDecoration: 'line-through' }}>link</span> ruim?
                </p>
                <button
                    onClick={() => window.location.href = '/'}
                    style={{
                        background: 'transparent',
                        border: '2px solid #67B1E0',
                        color: '#67B1E0',
                        padding: '0.6rem 1.4rem',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'background 0.2s, color 0.2s',
                    }}
                    onMouseEnter={e => { e.target.style.background = '#67B1E0'; e.target.style.color = '#09334f'; }}
                    onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#67B1E0'; }}
                >
                    Voltar ao início
                </button>
            </div>
        </div>
    );
}
