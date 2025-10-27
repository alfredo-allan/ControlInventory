import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4 sm:px-6">
      <Card className="w-full max-w-xs sm:max-w-md mx-auto">
        <CardContent className="pt-6 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 mb-4">
            <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 text-red-500 flex-shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 text-center sm:text-left">
              404 Page Not Found
            </h1>
          </div>

          <p className="mt-2 sm:mt-4 text-sm sm:text-base text-gray-600 text-center sm:text-left">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
