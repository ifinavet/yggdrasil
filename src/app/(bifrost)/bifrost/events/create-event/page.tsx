import { CreateEventForm } from "@/app/(bifrost)/bifrost/events/create-event/create-event-form";
import TitleUpdater from "@/app/(bifrost)/bifrost/title-updater";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function CreateEvent() {
    return (
        <div className='flex flex-col gap-4'>
            <TitleUpdater title='Opprett et helt magisk arrangement' />
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href='/bifrost'>Hjem</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href='/bifrost/events'>Arrangementer</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Opprett et arrangement</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            <CreateEventForm />
        </div>
    );
}
