import localFont from 'next/font/local';

export const eina = localFont({
  src: [
    {
      path: '../../../public/eina/Eina01-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../../public/eina/Eina01-LightItalic.ttf',
      weight: '300',
      style: 'italic',
    },
    {
      path: '../../../public/eina/Eina01-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../../public/eina/Eina01-RegularItalic.ttf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../../../public/eina/Eina01-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../../public/eina/Eina01-SemiboldItalic.ttf',
      weight: '600',
      style: 'italic',
    },
    {
      path: '../../../public/eina/Eina01-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../../public/eina/Eina01-BoldItalic.ttf',
      weight: '700',
      style: 'italic',
    },
  ],
})
