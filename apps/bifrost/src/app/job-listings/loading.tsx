import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@workspace/ui/components/tabs";
import { Plus } from "lucide-react";

export default function JobListingsLoading() {
	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Stillingsannonser</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className="flex justify-end">
				<Button asChild>
					<span>
						<Plus className="size-4" /> Opprett en ny stillingsannonse
					</span>
				</Button>
			</div>

			<Tabs defaultValue="published" className="w-full">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="published">
						<Skeleton className="h-4 w-24" />
					</TabsTrigger>
					<TabsTrigger value="unpublished">
						<Skeleton className="h-4 w-24" />
					</TabsTrigger>
				</TabsList>

				<TabsContent value="published" className="mt-6">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									<Skeleton className="h-4 w-16" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-20" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-12" />
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{Array.from({ length: 3 }).map((_, index) => (
								<TableRow key={`published-skeleton-row-${index * 2}`}>
									<TableCell>
										<Skeleton className="h-4 w-48" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-24" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-8 w-16 rounded-md" />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TabsContent>

				<TabsContent value="unpublished" className="mt-6">
					<div className="space-y-8">
						<div>
							<Skeleton className="mb-4 h-6 w-64" />
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>
											<Skeleton className="h-4 w-16" />
										</TableHead>
										<TableHead>
											<Skeleton className="h-4 w-20" />
										</TableHead>
										<TableHead>
											<Skeleton className="h-4 w-12" />
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{Array.from({ length: 2 }).map((_, index) => (
										<TableRow key={`active-skeleton-row-${index * 2}`}>
											<TableCell>
												<Skeleton className="h-4 w-48" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-24" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-8 w-16 rounded-md" />
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>

						<div>
							<Skeleton className="mb-4 h-6 w-72" />
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>
											<Skeleton className="h-4 w-16" />
										</TableHead>
										<TableHead>
											<Skeleton className="h-4 w-20" />
										</TableHead>
										<TableHead>
											<Skeleton className="h-4 w-12" />
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{Array.from({ length: 1 }).map((_, index) => (
										<TableRow key={`expired-skeleton-row-${index * 2}`}>
											<TableCell>
												<Skeleton className="h-4 w-48" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-24" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-8 w-16 rounded-md" />
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</>
	);
}
