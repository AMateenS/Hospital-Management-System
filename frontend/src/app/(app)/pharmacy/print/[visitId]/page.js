'use client';
import { useParams } from 'next/navigation';
import PrescriptionView from '@/components/PrescriptionView';
export default function Page() { return <PrescriptionView visitId={useParams().visitId} backLabel="Back to pharmacy" />; }
