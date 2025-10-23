/** @type {import('tailwindcss').Config} */
module.exports = {
    prefix: 'rg-',
    content: [
        "./src/**/*.{html,ts}", // src 폴더 내의 모든 html과 ts 파일을 스캔
    ],
    plugins: [],
    corePlugins: {
        preflight: false, // 호스트 앱과의 충돌을 막기 위해 preflight를 비활성화합니다.
    },
}