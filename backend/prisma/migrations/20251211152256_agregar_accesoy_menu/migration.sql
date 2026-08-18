-- CreateTable
CREATE TABLE "menus" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(100),
    "path" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "parent_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "menu_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_update" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_menu_parent" ON "menus"("parent_id");

-- CreateIndex
CREATE INDEX "idx_access_role" ON "access"("role_id");

-- CreateIndex
CREATE INDEX "idx_access_menu" ON "access"("menu_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_role_menu_access" ON "access"("role_id", "menu_id");

-- AddForeignKey
ALTER TABLE "access" ADD CONSTRAINT "access_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "access" ADD CONSTRAINT "access_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
