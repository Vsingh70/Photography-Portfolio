import localFont from 'next/font/local'

export const canela = localFont({
    src: [
        {
            path: './fonts/CanelaText-Thin-Trial.otf',
            weight: '100',
            style: 'normal',
        },
        {
            path: './fonts/CanelaText-ThinItalic-Trial.otf',
            weight: '100',
            style: 'italic',
        },
        {
            path: './fonts/CanelaText-Light-Trial.otf',
            weight: '300',
            style: 'normal',
        },
        {
            path: './fonts/CanelaText-LightItalic-Trial.otf',
            weight: '300',
            style: 'italic',
        },
        {
            path: './fonts/CanelaText-Regular-Trial.otf',
            weight: '400',
            style: 'normal',
        },
        {
            path: './fonts/CanelaText-RegularItalic-Trial.otf',
            weight: '400',
            style: 'italic',
        },
        {
            path: './fonts/CanelaText-Medium-Trial.otf',
            weight: '500',
            style: 'normal',
        },
        {
            path: './fonts/CanelaText-MediumItalic-Trial.otf',
            weight: '500',
            style: 'italic',
        },
        {
            path: './fonts/CanelaText-Bold-Trial.otf',
            weight: '700',
            style: 'normal',
        },
        {
            path: './fonts/CanelaText-BoldItalic-Trial.otf',
            weight: '700',
            style: 'italic',
        },
    ],

    variable: '--font-canela',
    display: 'swap',
})