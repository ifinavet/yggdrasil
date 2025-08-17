import TwoColumns from "../common/two-columns";
import ContainerCardSkeleton from "./container-card-skeleton";
import LargeUserCardSkeleton from "./large-user-card-skeleton";

export default function TwoColumnsLoading() {
	return <TwoColumns main={<ContainerCardSkeleton />} aside={<LargeUserCardSkeleton />} />;
}
