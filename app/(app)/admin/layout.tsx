import { notFound } from "next/navigation";
import AdminSectionNav from "@/components/admin/AdminSectionNav";
import { getCurrentUserAction } from "@/lib/auth/authActions";

const AdminLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
    const user = await getCurrentUserAction();

    if (!user || user.role !== "admin") {
        notFound();
    }

    return (
        <section className="relative">
            <div className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-8 sm:pt-10">
                <AdminSectionNav />
            </div>
            {children}
        </section>
    );
};

export default AdminLayout;
