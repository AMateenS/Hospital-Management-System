'use client';
import { useParams } from 'next/navigation';
import LabReportView from '@/components/LabReportView';
export default function Page() { return <LabReportView id={useParams().id} />; }
