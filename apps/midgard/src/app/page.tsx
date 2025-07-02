import { Card, CardContent } from "@workspace/ui/components/card";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@workspace/ui/components/carousel";

export default function MainPage() {
	const items = Array.from({ length: 5 }, (_, i) => i + 1);

	return (
		<div className='flex justify-center'>
			{/* <Carousel className="w-full max-w-xs">
      <CarouselContent>
        {items.map((item) => (
          <CarouselItem key={item}>
            <div className="p-1">
              <Card>
                <CardContent className="flex aspect-square items-center justify-center p-6">
                  <span className="text-4xl font-semibold">{item}</span>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel> */}
		</div>
	);
}
