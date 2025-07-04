export default function ResponsiveCenterContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className='mx-6 md:mx-auto md:w-5/6 lg:w-4/5 xl:w-8/14'>
      {children}
    </div>
  );
}
