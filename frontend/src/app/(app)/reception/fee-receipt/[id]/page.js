'use client';
import { useParams } from 'next/navigation';
import FeeReceiptView from '@/components/FeeReceiptView';
export default function Page() { return <FeeReceiptView id={useParams().id} />; }
