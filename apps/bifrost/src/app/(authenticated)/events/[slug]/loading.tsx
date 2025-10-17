import { Skeleton } from "@workspace/ui/components//skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components//table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

export default function RegistrationsLoading() {
	return (
		<Tabs defaultValue="registered">
			<TabsList>
				<TabsTrigger value="registered">Påmeldte</TabsTrigger>
				<TabsTrigger value="waitlist" disabled>
					Venteliste
				</TabsTrigger>
			</TabsList>

			<TabsContent value="registered">
				<h2 className="scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0">
					Påmeldte
				</h2>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Navn</TableHead>
							<TableHead>Bemærkninger</TableHead>
							<TableHead>Påmeldings tidspunkt</TableHead>
							<TableHead>Status</TableHead>
							<TableHead></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from({ length: 8 }).map((_, index) => (
							// biome-ignore lint: Its a loading file
							<TableRow key={index}>
								<TableCell>
									<Skeleton className="h-4 w-32" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-24" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-36" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-10 w-44" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-10 w-10" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TabsContent>

			<TabsContent value="waitlist">
				<h2 className="scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0">
					Venteliste
				</h2>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Navn</TableHead>
							<TableHead>Bemærkninger</TableHead>
							<TableHead>Påmeldings tidspunkt</TableHead>
							<TableHead>Status</TableHead>
							<TableHead></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from({ length: 3 }).map((_, index) => (
							// biome-ignore lint: Its a loading file
							<TableRow key={index}>
								<TableCell>
									<Skeleton className="h-4 w-32" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-24" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-36" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-10 w-44" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-10 w-10" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TabsContent>
		</Tabs>
	);
}
