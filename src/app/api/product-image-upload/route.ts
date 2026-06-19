import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import {
  getSupabaseStorageBucket,
  supabaseServer,
} from "@/lib/supabaseClient";

const maxUploadBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/webp", "webp"],
]);

function createStoragePath(userId: string, image: File) {
  const extension = allowedMimeTypes.get(image.type) || "jpg";

  return `uploads/${userId}/${crypto.randomUUID()}.${extension}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError({ code: "UNAUTHORIZED", status: 401 });
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return apiError({
        code: "BAD_REQUEST",
        message: "image file is required.",
        status: 400,
      });
    }

    const extension = allowedMimeTypes.get(image.type);

    if (!extension) {
      return apiError({
        code: "BAD_REQUEST",
        message: "image must be a PNG, JPEG, or WebP file.",
        status: 400,
      });
    }

    if (image.size <= 0) {
      return apiError({
        code: "BAD_REQUEST",
        message: "image cannot be empty.",
        status: 400,
      });
    }

    if (image.size > maxUploadBytes) {
      return apiError({
        code: "BAD_REQUEST",
        message: "image must be 10MB or smaller.",
        status: 400,
      });
    }

    const bucket = getSupabaseStorageBucket();
    const storagePath = createStoragePath(user.id, image);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, await image.arrayBuffer(), {
        cacheControl: "31536000",
        contentType: image.type === "image/jpg" ? "image/jpeg" : image.type,
        upsert: false,
      });

    if (error) {
      return apiError({ error, status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    return apiOk({ imageUrl: publicUrl, storagePath });
  } catch (error) {
    return handleApiError(error, "Product image upload failed.");
  }
}
