CREATE TABLE "ket_qua" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"van_id" uuid NOT NULL,
	"nguoi_dung_id" text NOT NULL,
	"thu_tu" integer NOT NULL,
	"tai_san" integer DEFAULT 0 NOT NULL,
	"so_o" integer DEFAULT 0 NOT NULL,
	"so_nha" integer DEFAULT 0 NOT NULL,
	"pha_san" boolean DEFAULT false NOT NULL,
	"thang" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nguoi_dung" (
	"id" text PRIMARY KEY NOT NULL,
	"ten" text NOT NULL,
	"email" text,
	"anh" text,
	"khach" boolean DEFAULT false NOT NULL,
	"so_van" integer DEFAULT 0 NOT NULL,
	"so_van_thang" integer DEFAULT 0 NOT NULL,
	"tao_luc" timestamp with time zone DEFAULT now() NOT NULL,
	"vao_lan_cuoi" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "van_dau" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ma_phong" text NOT NULL,
	"ten_phong" text NOT NULL,
	"co_mat_khau" boolean DEFAULT false NOT NULL,
	"bat_dau_luc" timestamp with time zone DEFAULT now() NOT NULL,
	"ket_thuc_luc" timestamp with time zone,
	"nguoi_thang" text,
	"so_luot" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ket_qua" ADD CONSTRAINT "ket_qua_van_id_van_dau_id_fk" FOREIGN KEY ("van_id") REFERENCES "public"."van_dau"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ket_qua" ADD CONSTRAINT "ket_qua_nguoi_dung_id_nguoi_dung_id_fk" FOREIGN KEY ("nguoi_dung_id") REFERENCES "public"."nguoi_dung"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "van_dau" ADD CONSTRAINT "van_dau_nguoi_thang_nguoi_dung_id_fk" FOREIGN KEY ("nguoi_thang") REFERENCES "public"."nguoi_dung"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ket_qua_van_idx" ON "ket_qua" USING btree ("van_id");--> statement-breakpoint
CREATE INDEX "ket_qua_nguoi_idx" ON "ket_qua" USING btree ("nguoi_dung_id");--> statement-breakpoint
CREATE INDEX "nguoi_dung_email_idx" ON "nguoi_dung" USING btree ("email");--> statement-breakpoint
CREATE INDEX "van_dau_bat_dau_idx" ON "van_dau" USING btree ("bat_dau_luc");