import { Document, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { STATUS_LABELS } from "@/lib/domain/job-status";
import { formatInZone, formatWindow } from "@/lib/domain/time";
import type { JobDetailDto } from "@/lib/services/jobs";

export interface ReportImage {
  data: Buffer;
  format: "jpg" | "png";
  label: string;
}

export interface JobReportProps {
  businessName: string;
  job: JobDetailDto;
  photos: ReportImage[];
  signature: ReportImage | null;
  appUrl: string;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  business: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  muted: { color: "#6b7280" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  section: { marginBottom: 14 },
  heading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 110, color: "#6b7280" },
  value: { flex: 1 },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: { width: 160 },
  photoImage: { width: 160, height: 120, objectFit: "cover", borderRadius: 3 },
  signature: {
    width: 200,
    height: 80,
    objectFit: "contain",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#6b7280" },
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

/** FR-PDF-01: business, customer, address, technician, times, notes, photos, signature. */
export function JobReport({ businessName, job, photos, signature, appUrl }: JobReportProps) {
  const tz = job.timezone;
  const at = (iso: string | null) => (iso ? formatInZone(iso, tz, "d MMM yyyy, HH:mm") : "-");
  const a = job.address;

  return (
    <Document title={`${job.number} job report`} author={businessName} creator="FieldOps">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.business}>{businessName}</Text>
            <Text style={styles.muted}>Job report</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>{job.number}</Text>
            <Text>{STATUS_LABELS[job.status]}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{job.title}</Text>
          {job.description ? <Text style={styles.muted}>{job.description}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Customer</Text>
          <Row label="Name" value={job.customerName} />
          <Row label="Phone" value={job.customerPhone} />
          <Row label="Address" value={`${a.label}: ${a.line1}, ${a.city} ${a.pincode}`} />
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Work</Text>
          <Row label="Technician" value={job.technicianName ?? "-"} />
          <Row label="Scheduled" value={formatWindow(job.scheduledStart, job.scheduledEnd, tz)} />
          <Row label="Started" value={at(job.startedAt)} />
          <Row label="Completed" value={at(job.completedAt)} />
          <Row label="Times shown in" value={tz} />
          <Row label="Notes" value={job.notes || "-"} />
        </View>

        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Photos</Text>
            <View style={styles.photos}>
              {photos.map((photo, i) => (
                <View key={i} style={styles.photo} wrap={false}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                  <Image
                    src={{ data: photo.data, format: photo.format }}
                    style={styles.photoImage}
                  />
                  <Text style={styles.muted}>{photo.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section} wrap={false}>
          <Text style={styles.heading}>Customer signature</Text>
          {signature ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
              <Image
                src={{ data: signature.data, format: signature.format }}
                style={styles.signature}
              />
              <Text style={styles.muted}>{signature.label}</Text>
            </>
          ) : (
            <Text style={styles.muted}>Not signed.</Text>
          )}
        </View>

        <Text style={styles.footer} fixed>
          Generated by FieldOps on {formatInZone(new Date(), tz, "d MMM yyyy, HH:mm")} ·{" "}
          <Link src={`${appUrl}/jobs/${job.id}`}>{`${appUrl}/jobs/${job.id}`}</Link>
        </Text>
      </Page>
    </Document>
  );
}
