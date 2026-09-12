import { handleProductionRequest } from "../../../../production/app";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleProductionRequest;
export const POST = handleProductionRequest;
export const PUT = handleProductionRequest;
export const PATCH = handleProductionRequest;
export const DELETE = handleProductionRequest;
export const HEAD = handleProductionRequest;
