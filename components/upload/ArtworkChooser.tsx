"use client";

import Image from "next/image";
import { Check, ImageOff, Upload } from "lucide-react";
import { useState } from "react";
import { imageLoader } from "@/lib/catalog/imageDelivery";
import { ARTWORK_UPLOAD_HELP } from "@/lib/artwork/artworkLimits";
import type { MetadataArtworkKind, MetadataReviewItem } from "@/lib/upload/uploadWorkflowTypes";
import s from "@/components/admin/admin.module.css";

const KINDS = {
    poster: { label: "Plakat", help: "Pionowa okładka na liście filmów i seriali.", action: "Ustaw jako plakat" },
    backdrop: { label: "Baner", help: "Poziome zdjęcie w tle na stronie materiału.", action: "Ustaw jako baner" },
    logo: { label: "Logo", help: "Graficzny tytuł na banerze. To pole jest opcjonalne.", action: "Ustaw jako logo" },
};

export default function ArtworkChooser({ item, busy, onSelect, onUpload }: {
    item: MetadataReviewItem;
    busy: boolean;
    onSelect: (id: number, label: string) => void;
    onUpload: (file: File, kind: MetadataArtworkKind) => void;
}) {
    const [kind, setKind] = useState<MetadataArtworkKind>("backdrop");
    const [draftId, setDraftId] = useState<number | null>(null);
    const images = item.artwork.filter((image) => image.kind === kind);
    const current = images.find((image) => image.isPrimary);
    const draft = images.find((image) => image.id === draftId) ?? current;
    const previewFor = (target: MetadataArtworkKind) => target === kind && draft ? draft : item.artwork.find((image) => image.kind === target && image.isPrimary);
    const poster = previewFor("poster");
    const backdrop = previewFor("backdrop");
    const logo = previewFor("logo");
    const hasChange = Boolean(draft && !draft.isPrimary);

    return <div className={s.stack}>
        <div className={s.preview} aria-label="Podgląd wybranych grafik">
            <div>
                <div className={s.posterPreview}>{poster ? <Image src={poster.url} alt={`Plakat: ${item.title}`} fill sizes="112px" loader={imageLoader(poster.url, "poster")} className="object-cover" /> : <ImageOff size={24} aria-label="Brak plakatu" />}</div>
                <p className={s.previewLabel}>Plakat w bibliotece</p>
            </div>
            <div>
                <div className={s.bannerPreview}>
                    {backdrop ? <Image src={backdrop.url} alt={`Baner: ${item.title}`} fill sizes="(max-width: 640px) 65vw, 650px" loader={imageLoader(backdrop.url, "hero")} className="object-cover" /> : <ImageOff size={32} aria-label="Brak banera" />}
                    {logo && <div className="absolute bottom-4 left-4 h-1/3 w-1/2"><Image src={logo.url} alt={`Logo: ${item.title}`} fill sizes="240px" loader={imageLoader(logo.url, "logo")} className="object-contain object-left-bottom" /></div>}
                </div>
                <p className={s.previewLabel}>{hasChange ? "Podgląd zmiany. Zapisz wybór poniżej." : "Baner na stronie materiału"}</p>
            </div>
        </div>

        <div className={s.artworkKinds} aria-label="Rodzaj grafiki">
            {(Object.keys(KINDS) as MetadataArtworkKind[]).map((value) => <button key={value} type="button" aria-pressed={kind === value} disabled={busy} className={s.kindButton} onClick={() => { setKind(value); setDraftId(null); }}>{KINDS[value].label}</button>)}
        </div>
        <div className={s.between}>
            <p className={s.muted}>{KINDS[kind].help}</p>
            {hasChange && <button type="button" className={s.button} disabled={busy} onClick={() => draft && onSelect(draft.id, KINDS[kind].label)}><Check size={16} aria-hidden="true" />{KINDS[kind].action}</button>}
        </div>
        {images.length > 0 ? <div className={s.artworkGrid} data-kind={kind} aria-label={`Dostępne grafiki: ${KINDS[kind].label}`}>
            {images.map((image, index) => <button key={image.id} type="button" className={s.artworkOption} aria-pressed={draft?.id === image.id} aria-label={`${KINDS[kind].label} ${index + 1}${image.isPrimary ? ", obecnie używany" : ", pokaż podgląd"}`} disabled={busy} onClick={() => setDraftId(image.id)}>
                <span className={s.artworkImage}><Image src={image.url} alt="" fill sizes={kind === "poster" ? "160px" : "300px"} loader={imageLoader(image.url, kind === "poster" ? "poster" : kind === "logo" ? "logo" : "catalog")} className={kind === "logo" ? "object-contain p-3" : "object-cover"} /></span>
                <span className={s.artworkCaption} data-selected={draft?.id === image.id}>
                    <span>{image.isPrimary ? "Obecny" : draft?.id === image.id ? "Podgląd" : image.provider === "manual" ? "Własny plik" : image.provider.toUpperCase()}</span>
                    {image.isPrimary ? <Check size={14} aria-hidden="true" /> : image.width && <span>{image.width}px</span>}
                </span>
            </button>)}
        </div> : <p className={s.muted}>Nie ma jeszcze tej grafiki. Uzupełnij dane z TMDB lub wybierz własny plik.</p>}

        <div className={s.upload}>
            <label className={`${s.secondary} ${s.uploadLabel}`} aria-disabled={busy}>
                <Upload size={16} aria-hidden="true" />Wybierz własny plik
                <input type="file" className="sr-only" aria-label={`Wgraj własną grafikę: ${KINDS[kind].label}`} disabled={busy} accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUpload(file, kind);
                    event.target.value = "";
                }} />
            </label>
            <div className="min-w-0 flex-1"><p className={s.muted}>{ARTWORK_UPLOAD_HELP}</p><p className="mt-1 text-xs text-nx-text-2">Po wysłaniu plik zostanie ustawiony jako {KINDS[kind].label.toLowerCase()}.</p></div>
        </div>
    </div>;
}
