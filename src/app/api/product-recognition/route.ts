import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { recognizeProductFromImage } from "@/lib/product-recognition";
import { supabaseServer } from "@/lib/supabaseClient";

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

    const body = (await request.json()) as {
      imageDataUrl?: unknown;
      imageUrl?: unknown;
    };
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    const imageDataUrl =
      typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
    const recognitionImageUrl =
      imageDataUrl.startsWith("data:image/") && URL.canParse(imageDataUrl)
        ? imageDataUrl
        : imageUrl;

    if (!imageUrl || !URL.canParse(imageUrl)) {
      return apiError({
        code: "BAD_REQUEST",
        message: "A valid imageUrl is required.",
        status: 400,
      });
    }

    const { model, rawResponse, recognition } =
      await recognizeProductFromImage(recognitionImageUrl);

    const { data, error } = await supabase
      .from("product_recognitions")
      .insert({
        user_id: user.id,
        image_url: imageUrl,
        model,
        product_name: recognition.product_name,
        category: recognition.category,
        target_user: recognition.target_user,
        highlights: recognition.highlights,
        raw_response: rawResponse,
      })
      .select(
        "id,image_url,product_name,category,target_user,highlights,created_at",
      )
      .single();

    if (error) {
      return apiError({ error, status: 500 });
    }

    return apiOk({ recognition: data });
  } catch (error) {
    return handleApiError(error, "Product recognition failed.");
  }
}
