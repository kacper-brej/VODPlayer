import UploadWorkflow from "@/components/upload/UploadWorkflow";
import { getUploadWorkflowSetup } from "@/lib/uploadWorkflowActions";

export default async function UploadPage() {
    const setup = await getUploadWorkflowSetup();

    return <UploadWorkflow initialSetup={setup} />;
}
