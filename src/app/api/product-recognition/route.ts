import { NextResponse } from "next/server";

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
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as { imageUrl?: unknown };
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";

    if (!imageUrl || !URL.canParse(imageUrl)) {
      return NextResponse.json(
        { error: "A valid imageUrl is required." },
        { status: 400 },
      );
    }

    const { model, rawResponse, recognition } =
      await recognizeProductFromImage(imageUrl);

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ recognition: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Product recognition failed.",
      },
      { status: 500 },
    );
  }
}
