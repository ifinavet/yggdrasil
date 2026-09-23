import { Button } from "@workspace/ui/components/button";
import { DialogClose, DialogFooter } from "@workspace/ui/components/dialog";

export default function DialogSaveFooter({
	isSubmitting,
	onSave,
}: Readonly<{ isSubmitting: boolean; onSave: () => void }>) {
	return (
		<DialogFooter>
			<DialogClose asChild>
				<Button variant="outline">Avbryt</Button>
			</DialogClose>
			<Button type="submit" disabled={isSubmitting} onClick={onSave}>
				{isSubmitting ? "Lagrer..." : "Lagre"}
			</Button>
		</DialogFooter>
	);
}
