"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-7xl mx-auto">
        <div className="p-4 border-b border-base-300">
          <h1 className="text-2xl font-bold">Yamix API Documentation</h1>
          <p className="text-sm text-base-content/60 mt-1">
            OpenAPI 3.0仕様 | FastAPI（Yamii）との統一規格
          </p>
        </div>
        <SwaggerUI url="/api/openapi" />
      </div>
    </div>
  );
}
