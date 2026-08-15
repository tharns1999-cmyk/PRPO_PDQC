# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, Vite, Tailwind CSS (built as a single-file bundle for Google Apps Script deployment).

## Users

ฝ่ายผลิต (Production - PD) และฝ่ายควบคุมคุณภาพ (Quality Control - QC) จำนวนประมาณ 6 คน ที่ต้องการระบบจัดการเอกสารและการเบิกจ่ายที่เรียบง่าย ไม่ซับซ้อน

## Product Purpose

Web Application สำหรับจัดการวงจรการจัดซื้อและคลังสินค้าขนาดเล็ก ครอบคลุมตั้งแต่การเปิดใบขอซื้อ (PR), การอนุมัติและออกใบสั่งซื้อ (PO), การรับสินค้าเข้าคลังอัตโนมัติ, การเบิกจ่ายสินค้า (Quick Issue), และการดูบัตรคุมสต็อก (Stock Card) พร้อมการควบคุมงบประมาณประจำเดือน

## Positioning

ระบบอุตสาหกรรมขนาดเล็กที่เน้น "ความเรียบง่าย" (Industrial Simplicity) และความรวดเร็วในการใช้งาน เช่น ระบบ Auto-PR สำหรับสินค้าที่สต็อกต่ำ โดยออกแบบมาเพื่อรันบน Google Apps Script (GAS) ได้ในไฟล์เดียว

## Operating Context

ใช้งานภายในโรงงานหรือสำนักงานของบริษัท พีดีคิวซี จำกัด มีการแบ่งแยกสิทธิการเข้าถึงข้อมูลตาม Role (เช่น Staff, Supervisor, Manager, System Admin) และมีการพิมพ์เอกสารใบสั่งซื้อ (PO) ออกทางหน้ากระดาษ A4 เพื่อเป็นหลักฐานทางการ

## Capabilities and Constraints

- รองรับระบบ Role-Based Access Control
- ระบบทำงานในรูปแบบ Single-page Application โดยฝัง Logic และ UI ไว้ในไฟล์ HTML เดียวเมื่อ Build เสร็จ (เพื่อใช้บน GAS)
- เก็บข้อมูลผ่าน API/Storage Service ที่สลับใช้ Mock/LocalStorage สำหรับ Local Dev และ google.script.run สำหรับ Production ได้

## Brand Commitments

- ชื่อบริษัท: บริษัท พีดีคิวซี จำกัด (PDQC Co., Ltd.)
- เอกสารทางการ (PO) ต้องมีหัวกระดาษและฟอร์มที่เป็นมาตรฐานบริษัท

## Evidence on Hand

- Mock Data เบื้องต้นสำหรับจำลองผู้ใช้งาน สินค้า และประวัติการสั่งซื้อ
- โครงสร้างและ Logic ของเอกสาร PR/PO ที่พัฒนาเสร็จสิ้นแล้ว

## Product Principles

1. **Keep it simple and robust**: ฟังก์ชันต้องตรงไปตรงมา ไม่ซับซ้อน เหมาะสำหรับทีมงานขนาดเล็ก
2. **Speed over bureaucracy**: ลดขั้นตอนการทำงานที่ยุ่งยากด้วย Automations เช่น Auto-PR และ Receive All
3. **Clear boundary**: ข้อมูลการเงินและงบประมาณต้องถูกควบคุมและเห็นได้เฉพาะผู้ที่มีสิทธิ์เท่านั้น
